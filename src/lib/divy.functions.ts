import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ActionItem,
  ActivityEvent,
  CycleState,
  Deposit,
  Dispute,
  DisputeStatus,
  PaymentRow,
  RecurFreq,
  ExpenseCard,
  FundingRequest,
  GroupCard,
  GroupDetail,
  GroupExpense,
  GroupKind,
  LinkedAccount,
  Member,
  NotificationItem,
  Person,
  Friend,
  FriendTie,
  ScoreFactor,
  ScoreBreakdown,
  SettleFrequency,
  SettleMode,
  Snapshot,
  WalletTx,
} from "./divy-types";
import { addDays, advance, isoDay, payPhase, scoreRating, settleWindow } from "./divy-types";

/* ---------------- helpers (pure) ---------------- */

const MIX_COLORS = ["#7c3aed", "#a855f7", "#c084fc", "#ddd6fe"];

function n(value: unknown) {
  return Number(value ?? 0);
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value.length <= 10 ? `${value}T12:00:00Z` : value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const DAY_MS = 86_400_000;

// Whole days from now until a date-only string ("Sep 14"), using the same
// noon-UTC convention as payPhase. Negative = that many days in the past.
function dayCount(target: string | null | undefined, now = Date.now()): number | null {
  if (!target) return null;
  const t = new Date(target.length <= 10 ? `${target}T12:00:00Z` : target).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - now) / DAY_MS);
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// A member's Divy score as their group-mates see it. Profiles are private under
// RLS, so peers get a stable score derived from how they settle: paid up and
// square scores high, carrying debt drags it down.
function peerScore(id: string, duesPaid: boolean, balance: number) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 997;
  let score = 74 + (hash % 13); // 74–86 baseline, stable per member
  score += duesPaid ? 9 : -14;
  if (balance < -0.01) score -= Math.min(12, Math.round(Math.abs(balance) / 25));
  else if (balance > 0.01) score += 3;
  return Math.max(42, Math.min(99, score));
}

function fmtWhen(value: string) {
  const then = new Date(value).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return fmtDate(value);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/* ---------------- snapshot ---------------- */

/** Apply a per-member share map to balances (sign -1 reverses it). */
async function applyShareBalances(
  supabase: any,
  groupId: string,
  payerId: string | null,
  total: number,
  shares: Record<string, number>,
  sign: 1 | -1 = 1,
) {
  const roster = await supabase.from("group_members").select("id, balance").eq("group_id", groupId);
  for (const m of roster.data ?? []) {
    const owed = round2(Number(shares[m.id] ?? 0));
    const delta = (m.id === payerId ? total - owed : -owed) * sign;
    if (!delta) continue;
    await supabase
      .from("group_members")
      .update({ balance: round2(Number(m.balance ?? 0) + delta) })
      .eq("id", m.id);
  }
}

/** Apply an expense's effect on every member's balance (sign -1 reverses it). */
async function applyExpenseBalances(
  supabase: any,
  groupId: string,
  payerId: string | null,
  total: number,
  each: number,
  sign: 1 | -1 = 1,
) {
  const roster = await supabase.from("group_members").select("id, balance").eq("group_id", groupId);
  for (const m of roster.data ?? []) {
    const delta = (m.id === payerId ? total - each : -each) * sign;
    await supabase
      .from("group_members")
      .update({ balance: round2(Number(m.balance ?? 0) + delta) })
      .eq("id", m.id);
  }
}

/** Post any repeating expenses whose next date has arrived. */
async function materializeRecurring(supabase: any, groupIds: string[]) {
  if (!groupIds.length) return;
  const today = isoDay(new Date());
  const due = await supabase
    .from("expenses")
    .select("*")
    .in("group_id", groupIds)
    .not("recur_freq", "is", null)
    .lte("recur_next", today);

  for (const e of due.data ?? []) {
    const freq = e.recur_freq as RecurFreq;
    let next = String(e.recur_next).slice(0, 10);
    let made = 0;
    while (next <= today && made < 6) {
      const total = round2(Number(e.total ?? 0));
      const each = round2(Number(e.each_amount ?? 0));
      await supabase.from("expenses").insert({
        group_id: e.group_id,
        payer_member_id: e.payer_member_id,
        title: e.title,
        total,
        each_amount: each,
        category: e.category,
        spent_on: next,
        receipt_key: e.receipt_key,
        added_by: e.added_by ?? null,
        recur_parent: e.recur_parent ?? e.id,
      });
      await applyExpenseBalances(supabase, e.group_id, e.payer_member_id, total, each, 1);
      next = advance(next, freq, 1);
      made += 1;
    }
    await supabase.from("expenses").update({ recur_next: next }).eq("id", e.id);
  }
}

function shortDay(day: string) {
  return new Date(`${day.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Scheduled split groups run themselves: the settle-up window opens on its own
 * date, closes after the confirmation days, and once everyone is square the
 * next cycle rolls forward automatically. Anytime groups are untouched — their
 * admin opens the window by hand.
 */
async function runScheduledCycles(
  supabase: any,
  groupRows: any[],
  membersByGroup: Map<string, any[]>,
  userId: string,
) {
  const today = isoDay(new Date());

  for (const g of groupRows) {
    if (g.kind === "wallet") continue;
    if (g.settle_mode !== "scheduled" || !g.settle_anchor) continue;

    const freq = (g.settle_frequency ?? "monthly") as SettleFrequency;
    const confirmDays = Math.max(1, Number(g.confirm_days ?? 1));
    const roster = membersByGroup.get(g.id) ?? [];
    const allSquare = roster.every((m) => Math.abs(Number(m.balance ?? 0)) < 0.005);

    let anchor = String(g.settle_anchor).slice(0, 10);
    // once a finished cycle's window has passed, jump to the next scheduled date
    let guard = 0;
    while (allSquare && addDays(anchor, confirmDays) < today && guard < 120) {
      anchor = advance(anchor, freq, 1);
      guard += 1;
    }

    const w = settleWindow(anchor, confirmDays);
    let state: CycleState;
    let label: string;
    if (today < w.opens) {
      state = "open";
      label = `Settles ${shortDay(w.opens)}`;
    } else if (today <= w.due) {
      state = "settling";
      label = `Pay by ${shortDay(w.due)}`;
    } else if (allSquare) {
      state = "settled";
      label = "All even";
    } else {
      state = "overdue";
      label = `Overdue since ${shortDay(w.due)}`;
    }

    const patch: Record<string, unknown> = {};
    if (anchor !== String(g.settle_anchor).slice(0, 10)) patch["settle_anchor"] = anchor;
    if (String(g.payment_opens ?? "").slice(0, 10) !== w.opens) patch["payment_opens"] = w.opens;
    if (String(g.payment_due ?? "").slice(0, 10) !== w.due) patch["payment_due"] = w.due;
    if (g.cycle_state !== state) patch["cycle_state"] = state;
    if (g.cycle_label !== label) patch["cycle_label"] = label;
    if (!Object.keys(patch).length) continue;

    const opened = patch["cycle_state"] === "settling";
    await supabase.from("groups").update(patch).eq("id", g.id);
    Object.assign(g, patch);

    if (opened) {
      // fresh window: everyone who still owes starts as unpaid
      for (const m of roster) {
        const square = Math.abs(Number(m.balance ?? 0)) < 0.005;
        if (m.dues_paid !== square) {
          await supabase.from("group_members").update({ dues_paid: square }).eq("id", m.id);
          m.dues_paid = square;
        }
      }
      await supabase.from("activity_events").insert({
        profile_id: userId,
        group_id: g.id,
        kind: "cycle",
        who: g.name,
        text: `settle-up window is open · pay by ${shortDay(w.due)}`,
        amount: null,
        unread: true,
      });
      await supabase.from("notifications").insert({
        profile_id: userId,
        title: `${g.name} settle-up is open`,
        body: `Confirm your split and pay by ${shortDay(w.due)}.`,
        tone: "calm",
        unread: true,
      });
    }
  }
}


export const getSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Snapshot> => {
    const { supabase, userId } = context;

    const profileRes = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    let profile = profileRes.data;
    if (!profile) {
      const created = await supabase
        .from("profiles")
        .insert({ id: userId, name: "New member" })
        .select("*")
        .single();
      profile = created.data;
      await supabase.from("wallets").insert({ profile_id: userId }).select().maybeSingle();
    }

    const [walletRes, accountsRes, myMembershipsRes, notificationsRes, activityRes, walletTxRes] =
      await Promise.all([
        supabase.from("wallets").select("*").eq("profile_id", userId).maybeSingle(),
        supabase.from("linked_accounts").select("*").eq("profile_id", userId).order("created_at"),
        supabase.from("group_members").select("group_id").eq("profile_id", userId),
        supabase
          .from("notifications")
          .select("*")
          .eq("profile_id", userId)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("activity_events")
          .select("*")
          .eq("profile_id", userId)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("wallet_transactions")
          .select("*")
          .eq("profile_id", userId)
          .order("occurred_on", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

    if (!walletRes.data) await supabase.from("wallets").insert({ profile_id: userId });

    const groupIds = (myMembershipsRes.data ?? []).map((r) => r.group_id);
    await materializeRecurring(supabase, groupIds);

    const [disputesRes, settlementsRes] = await Promise.all([
      groupIds.length
        ? supabase
            .from("disputes")
            .select("*")
            .in("group_id", groupIds)
            .order("created_at", { ascending: false })
        : { data: [] as never[] },
      supabase
        .from("settlements")
        .select("*")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    const [groupsRes, membersRes, expensesRes, fundingRes, depositsRes] = await Promise.all([
      groupIds.length
        ? supabase.from("groups").select("*").in("id", groupIds).order("created_at")
        : { data: [] as never[] },
      groupIds.length
        ? supabase.from("group_members").select("*").in("group_id", groupIds).order("created_at")
        : { data: [] as never[] },
      groupIds.length
        ? supabase
            .from("expenses")
            .select("*")
            .in("group_id", groupIds)
            .order("spent_on", { ascending: false })
            .order("created_at", { ascending: false })
        : { data: [] as never[] },
      groupIds.length
        ? supabase.from("funding_requests").select("*").in("group_id", groupIds).order("created_at")
        : { data: [] as never[] },
      groupIds.length
        ? supabase
            .from("deposits")
            .select("*")
            .in("group_id", groupIds)
            .order("occurred_on", { ascending: false })
        : { data: [] as never[] },
    ]);

    const groupRows = groupsRes.data ?? [];
    const memberRows = membersRes.data ?? [];
    const expenseRows = expensesRes.data ?? [];
    const fundingRows = fundingRes.data ?? [];
    const depositRows = depositsRes.data ?? [];

    const membersByGroup = new Map<string, typeof memberRows>();
    for (const m of memberRows) {
      const list = membersByGroup.get(m.group_id) ?? [];
      list.push(m);
      membersByGroup.set(m.group_id, list);
    }
    const memberById = new Map(memberRows.map((m) => [m.id, m]));

    await runScheduledCycles(supabase, groupRows, membersByGroup, userId);

    const groups: GroupCard[] = [];
    const groupDetails: Record<string, GroupDetail> = {};
    const actionItems: ActionItem[] = [];

    for (const g of groupRows) {
      const kind = g.kind as GroupKind;
      const roster = membersByGroup.get(g.id) ?? [];
      const mine = roster.find((m) => m.profile_id === userId) ?? null;
      const groupExpenses = expenseRows.filter((e) => e.group_id === g.id);
      const balance = round2(n(mine?.balance));

      const members: Member[] = roster.map((m) => ({
        id: m.id,
        name: m.profile_id === userId ? "You" : m.display_name,
        avatarKey: m.avatar_key,
        balance: round2(n(m.balance)),
        paid: m.dues_paid,
        admin: m.is_admin,
        isYou: m.profile_id === userId,
        handle: m.handle,
      }));

      const expenses: GroupExpense[] = groupExpenses.map((e) => {
        const payer = e.payer_member_id ? memberById.get(e.payer_member_id) : null;
        const addedByMember = e.added_by
          ? roster.find((m) => m.profile_id === e.added_by)
          : null;
        return {
          id: e.id,
          title: e.title,
          payer: payer ? (payer.profile_id === userId ? "You" : payer.display_name) : "Someone",
          payerMemberId: e.payer_member_id ?? null,
          addedBy: e.added_by ?? null,
          addedByName: addedByMember
            ? addedByMember.profile_id === userId
              ? "You"
              : addedByMember.display_name
            : null,
          canEdit: !!mine?.is_admin || e.added_by === userId,
          claimStatus: (e.claim_status as GroupExpense["claimStatus"]) ?? null,
          date: fmtDate(e.spent_on),
          isoDate: String(e.spent_on).slice(0, 10),
          total: round2(n(e.total)),
          each: round2(n(e.each_amount)),
          category: e.category,
          paid: e.paid,
          receiptKey: e.receipt_key ?? null,
          items: (e.items as GroupExpense["items"]) ?? null,
          shares: (e.shares as GroupExpense["shares"]) ?? null,
          recur: (e.recur_freq as RecurFreq | null) ?? null,
          disputeStatus:
            ((disputesRes.data ?? []).find((d: any) => d.expense_id === e.id)?.status as
              | DisputeStatus
              | undefined) ?? null,
        };
      });

      const totalSpent = round2(groupExpenses.reduce((sum, e) => sum + n(e.total), 0));
      const youPaid = round2(
        groupExpenses
          .filter((e) => mine && e.payer_member_id === mine.id)
          .reduce((sum, e) => sum + n(e.total), 0),
      );
      const yourShare = round2(groupExpenses.reduce((sum, e) => sum + n(e.each_amount), 0));

      const lastExpense = groupExpenses[0];
      const lastActivity = lastExpense
        ? `Last expense ${fmtWhen(lastExpense.created_at).replace(" ago", " ago")}`
        : "No expenses yet";

      const walletDeposits: Deposit[] = depositRows
        .filter((d) => d.group_id === g.id)
        .map((d) => {
          const m = d.member_id ? memberById.get(d.member_id) : null;
          return {
            id: d.id,
            name: m ? (m.profile_id === userId ? "You" : m.display_name) : "Member",
            avatarKey: m?.avatar_key ?? "a1",
            amount: round2(n(d.amount)),
            date: d.status === "pending" ? "Pending" : fmtDate(d.occurred_on),
            isoDate: String(d.occurred_on).slice(0, 10),
            pending: d.status === "pending",
          };
        });

      const fundingRequests: FundingRequest[] = fundingRows
        .filter((f) => f.group_id === g.id)
        .map((f) => ({
          id: f.id,
          title: f.title,
          due: f.due_on ? fmtDate(f.due_on) : "No due date",
          dueIso: f.due_on ? String(f.due_on).slice(0, 10) : null,
          amount: round2(n(f.amount)),
          audience: f.audience,
          collected: round2(n(f.collected)),
          goal: round2(n(f.goal)),
          contributors: roster.map((m) => {
            const paidIn = round2(
              depositRows
                .filter((d) => d.request_id === f.id && d.member_id === m.id)
                .reduce((sum, d) => sum + n(d.amount), 0),
            );
            return {
              memberId: m.id,
              name: m.profile_id === userId ? "You" : m.display_name,
              avatarKey: m.avatar_key,
              isYou: m.profile_id === userId,
              expected: round2(n(f.amount)),
              paid: paidIn,
              settled: paidIn >= round2(n(f.amount)) - 0.005,
            };
          }),
        }));

      const available = round2(
        kind === "wallet" ? depositRows.filter((d) => d.group_id === g.id && d.status !== "pending").reduce((s, d) => s + n(d.amount), 0) : 0,
      );
      const unpaidExpenses = round2(
        groupExpenses.filter((e) => !e.paid).reduce((s, e) => s + n(e.total), 0),
      );
      const unfunded = round2(fundingRequests.reduce((s, f) => s + (f.goal - f.collected), 0));
      const yourDues = mine && !mine.dues_paid ? Math.abs(balance) : 0;

      // anytime groups have no real settle window unless an admin opened one
      const scheduledGroup = g.settle_mode === "scheduled" && !!g.settle_anchor;
      const windowLive = g.cycle_state === "settling" || g.cycle_state === "overdue";
      const shownLabel =
        kind === "split" && !scheduledGroup && !windowLive && g.cycle_state === "open"
          ? "Awaiting settle-up"
          : g.cycle_label;

      groups.push({
        id: g.id,
        kind,
        name: g.name,
        coverKey: g.cover_key,
        members: roster.length,
        memberAvatars: roster.filter((m) => m.profile_id !== userId).map((m) => m.avatar_key),
        lastActivity,
        balance,
        available,
        cycle: g.cycle_state as CycleState,
        cycleLabel: shownLabel,
        progress: g.progress,
        youAdmin: !!mine?.is_admin,
        archived: !!g.archived,
        });

      groupDetails[g.id] = {
        id: g.id,
        name: g.name,
        kind,
        coverKey: g.cover_key,
        joinCode: g.join_code,
        purpose: g.purpose,
        cycle: g.cycle_state as CycleState,
        cycleLabel: shownLabel,
        progress: g.progress,
        balance,
        members,
        expenses,
        totalSpent,
        cycleStart: fmtDate(g.cycle_start),
        cycleEnd: fmtDate(g.cycle_end),
        youPaid,
        yourShare,
        yourMemberId: mine?.id ?? null,
        youAdmin: !!mine?.is_admin,
        settleMode: (g.settle_mode as GroupDetail["settleMode"]) ?? "anytime",
        settleFrequency: (g.settle_frequency as GroupDetail["settleFrequency"]) ?? null,
        settleAnchor: g.settle_anchor ? String(g.settle_anchor).slice(0, 10) : null,
        confirmDays: Number(g.confirm_days ?? 1),
        multicurrency: !!g.multicurrency,
        wallet:
          kind === "wallet"
            ? {
                available,
                pending: round2(
                  depositRows
                    .filter((d) => d.group_id === g.id && d.status === "pending")
                    .reduce((s, d) => s + n(d.amount), 0),
                ),
                unpaidExpenses,
                unfundedContributions: unfunded,
                totalContribution: available,
                totalReimbursement: round2(
                  groupExpenses.filter((e) => e.paid).reduce((s, e) => s + n(e.total), 0),
                ),
                yourDues,
                deposits: walletDeposits,
                fundingRequests,
              }
            : null,
      };

      // action items — timing is computed from the group's payment window.
      // Anytime groups only have a window while an admin's settle-up is running;
      // scheduled groups only ask for money once their window is actually open.
      const hasWindow = scheduledGroup || windowLive;
      const phase = hasWindow ? payPhase(g.payment_opens, g.payment_due) : null;
      const dueLabel = fmtDate(g.payment_due);
      const opensIn = dayCount(g.payment_opens);
      const dueIn = dayCount(g.payment_due);
      // countdown phrasing — "3 days overdue", "2 days left", "Opens in 3 days"
      const timingNote =
        phase === "upcoming"
          ? `Opens in ${plural(Math.max(1, opensIn ?? 1), "day")}`
          : phase === "overdue"
            ? `${plural(Math.max(1, -(dueIn ?? -1)), "day")} overdue`
            : phase === "duesoon"
              ? `${plural(Math.max(0, dueIn ?? 0), "day")} left to pay`
              : null;
      // short corner-badge text for the group logo — "3d late", "2d left", "in 3d"
      const badgeText =
        phase === "upcoming"
          ? `in ${Math.max(1, opensIn ?? 1)}d`
          : phase === "overdue"
            ? `${Math.max(1, -(dueIn ?? -1))}d late`
            : phase === "duesoon"
              ? `${Math.max(0, dueIn ?? 0)}d left`
              : null;
      const badge: ActionItem["badge"] = badgeText
        ? { text: badgeText, tone: phase === "overdue" ? "urgent" : "warn" }
        : undefined;

      if (g.archived) continue;
      // nobody pays outside a settle-up window — no window, nothing to do
      if (kind === "split" && !windowLive) continue;

      if (kind === "wallet" && mine && !mine.dues_paid && balance < 0) {
        const fallback = fundingRequests[0]
          ? `${fundingRequests[0].title} · due ${fundingRequests[0].due}`
          : "Dues open";
        actionItems.push({
          id: `act-${g.id}`,
          groupId: g.id,
          group: g.name,
          coverKey: g.cover_key,
          amount: balance,
          note:
            phase === "open" && dueLabel
              ? fundingRequests[0]
                ? `${fundingRequests[0].title} · due ${dueLabel}`
                : `Due ${dueLabel}`
              : (timingNote ?? fallback),
          badge,
          cta: phase === "upcoming" ? "View" : "Pay",
          tone:
            phase === "overdue"
              ? "urgent"
              : phase === "upcoming" || phase === "duesoon"
                ? "warn"
                : "open",
          kind,
        });
      } else if (kind === "split" && balance < 0 && phase !== "upcoming") {
        const overdue = phase === "overdue";
        actionItems.push({
          id: `act-${g.id}`,
          groupId: g.id,
          group: g.name,
          coverKey: g.cover_key,
          amount: balance,
          note: timingNote ?? (overdue ? g.cycle_label : "Settle window open · confirm split"),
          badge,
          cta: "Pay",
          tone: overdue ? "urgent" : phase === "open" ? "open" : "warn",
          kind,
        });
      } else if (kind === "split" && balance > 0 && phase !== "upcoming") {
        const debtor = members.find((m) => !m.isYou && m.balance < 0);
        // nobody actually owes you money — nothing to chase
        if (!debtor) continue;
        actionItems.push({
          id: `act-${g.id}`,
          groupId: g.id,
          group: g.name,
          coverKey: g.cover_key,
          amount: balance,
          note:
            phase === "overdue" && timingNote
              ? `${debtor.name} hasn't paid · ${timingNote}`
              : `${debtor.name} hasn't paid you yet`,
          badge: hasWindow ? badge : undefined,
          cta: "Remind",
          tone: phase === "overdue" ? "urgent" : phase === "duesoon" ? "warn" : "calm",
          kind,
        });
      }
    }

    const groupById = new Map(groupRows.map((g) => [g.id, g]));

    const recentExpenses: ExpenseCard[] = expenseRows.slice(0, 6).map((e) => {
      const g = groupById.get(e.group_id);
      return {
        id: e.id,
        title: e.title,
        group: g?.name ?? "Group",
        groupId: e.group_id,
        date: fmtDate(e.spent_on),
        total: round2(n(e.total)),
        each: round2(n(e.each_amount)),
        coverKey: g?.cover_key ?? "nyc",
      };
    });

    const owedToYou = round2(groups.filter((g) => g.balance > 0).reduce((s, g) => s + g.balance, 0));
    const youOwe = round2(
      Math.abs(groups.filter((g) => g.balance < 0).reduce((s, g) => s + g.balance, 0)),
    );

    const byPerson = new Map<string, number>();
    for (const g of groupRows) {
      for (const m of membersByGroup.get(g.id) ?? []) {
        if (m.profile_id === userId) continue;
        const amount = -n(m.balance);
        if (!amount) continue;
        byPerson.set(m.display_name, (byPerson.get(m.display_name) ?? 0) + amount);
      }
    }
    const peopleBalances = [...byPerson.entries()]
      .map(([name, amount]) => ({ name, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    const byCategory = new Map<string, number>();
    for (const e of expenseRows) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + n(e.total));
    }
    const spendingMix = [...byCategory.entries()]
      .map(([label, value]) => ({ label, value: round2(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)
      .map((slice, i) => ({ ...slice, color: MIX_COLORS[i] ?? "#ddd6fe" }));

    const monthStart = new Date();
    monthStart.setDate(1);
    const monthExpenses = expenseRows.filter((e) => new Date(`${e.spent_on}T12:00:00Z`) >= monthStart);
    const monthByCategory = new Map<string, number>();
    for (const e of monthExpenses) {
      monthByCategory.set(e.category, (monthByCategory.get(e.category) ?? 0) + n(e.total));
    }
    const topCategory = [...monthByCategory.entries()].sort((a, b) => b[1] - a[1])[0];

    const people: Person[] = [];
    const seen = new Set<string>();
    for (const m of memberRows) {
      if (m.profile_id === userId || seen.has(m.display_name)) continue;
      seen.add(m.display_name);
      people.push({
        id: m.id,
        name: m.display_name,
        handle: m.handle ?? `@${m.display_name.toLowerCase().replace(/[^a-z]/g, "")}`,
        avatarKey: m.avatar_key,
      });
    }

    const activityFeed: ActivityEvent[] = (activityRes.data ?? []).map((a) => ({
      id: a.id,
      kind: a.kind as ActivityEvent["kind"],
      who: a.who,
      text: a.text,
      amount: a.amount === null ? null : round2(n(a.amount)),
      when: fmtWhen(a.created_at),
      unread: a.unread,
    }));

    const walletTransactions: WalletTx[] = (walletTxRes.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      note: t.note,
      date: fmtDate(t.occurred_on),
      amount: round2(n(t.amount)),
    }));

    const notifications: NotificationItem[] = (notificationsRes.data ?? []).map((x) => ({
      id: x.id,
      title: x.title,
      body: x.body,
      when: fmtWhen(x.created_at),
      tone: x.tone as NotificationItem["tone"],
      unread: x.unread,
    }));

    const linkedAccounts: LinkedAccount[] = (accountsRes.data ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      detail: a.detail,
      kind: a.kind as LinkedAccount["kind"],
      primary: a.is_primary,
    }));

    const expenseById = new Map(expenseRows.map((e) => [e.id, e]));
    const disputes: Dispute[] = (disputesRes.data ?? []).map((d: any) => {
      const e = d.expense_id ? expenseById.get(d.expense_id) : null;
      return {
        id: d.id,
        groupId: d.group_id,
        group: groupById.get(d.group_id)?.name ?? "Group",
        expenseId: d.expense_id ?? null,
        expenseTitle: e?.title ?? "An expense",
        amount: round2(n(e?.total)),
        by: d.raised_by === userId ? "You" : d.raised_name,
        byYou: d.raised_by === userId,
        reason: d.reason,
        status: d.status as DisputeStatus,
        resolution: d.resolution ?? null,
        when: fmtWhen(d.created_at),
      };
    });

    const paymentHistory: PaymentRow[] = [
      ...(settlementsRes.data ?? []).map((s: any) => ({
        id: `s-${s.id}`,
        date: fmtDate(s.created_at),
        isoDate: String(s.created_at).slice(0, 10),
        label: s.kind === "dues" ? "Dues payment" : "Settle-up",
        group: s.group_id ? (groupById.get(s.group_id)?.name ?? "Group") : "Divy",
        amount: -round2(n(s.amount)),
        method: s.source === "bank" ? "Bank account" : "Divy wallet",
      })),
      ...(walletTxRes.data ?? []).map((t: any) => ({
        id: `w-${t.id}`,
        date: fmtDate(t.occurred_on),
        isoDate: String(t.occurred_on).slice(0, 10),
        label: t.name,
        group: "Divy wallet",
        amount: round2(n(t.amount)),
        method: t.note || "Divy wallet",
      })),
    ].sort((a, b) => (a.isoDate < b.isoDate ? 1 : a.isoDate > b.isoDate ? -1 : 0));

    /* ---------------- divy score ---------------- */

    const myRows = memberRows.filter((m) => m.profile_id === userId);
    const nowMs = Date.now();

    // 1. On-time settle-ups (40): cycles closed without going past the due date.
    let onTime = 0;
    let late = 0;
    for (const g of groupRows) {
      const mine2 = (membersByGroup.get(g.id) ?? []).find((m) => m.profile_id === userId);
      if (!mine2 || !g.payment_due) continue;
      const square = mine2.dues_paid && n(mine2.balance) >= -0.01;
      const overdue = payPhase(g.payment_opens, g.payment_due, nowMs) === "overdue";
      if (square) onTime += 1;
      else if (overdue) late += 1;
    }
    const cycles = onTime + late;
    const onTimeRate = cycles ? onTime / cycles : 1;
    const onTimePts = Math.round(40 * onTimeRate);


    // 2. Speed (20): average days after a window opens before you pay. 1 day = full marks.
    const mySettlements = settlementsRes.data ?? [];
    const lags: number[] = [];
    for (const s of mySettlements) {
      const g = s.group_id ? groupById.get(s.group_id) : null;
      const opens = g?.payment_opens ?? g?.cycle_start ?? null;
      if (!opens) continue;
      const openMs = new Date(`${String(opens).slice(0, 10)}T12:00:00Z`).getTime();
      const paidMs = new Date(s.created_at).getTime();
      if (Number.isNaN(openMs) || Number.isNaN(paidMs)) continue;
      lags.push(Math.max(0, (paidMs - openMs) / DAY_MS));
    }
    const avgLag = lags.length ? lags.reduce((a, b) => a + b, 0) / lags.length : null;
    const speedPts = avgLag === null ? 14 : Math.max(0, Math.min(20, Math.round(20 - 2 * Math.max(0, avgLag - 1))));

    // 3. Clean charges (15): expenses you added that someone flagged.
    const flagged = (disputesRes.data ?? []).filter((d: any) => {
      const e = d.expense_id ? expenseById.get(d.expense_id) : null;
      return e?.added_by === userId;
    }).length;
    const cleanPts = Math.max(0, 15 - 5 * flagged);

    // 4. Standing (15): share of your groups where you owe nothing.
    const squareGroups = myRows.filter((m) => n(m.balance) >= -0.01).length;
    const standingRate = myRows.length ? squareGroups / myRows.length : 1;
    const standingPts = Math.round(15 * standingRate);

    // 5. Participation (10): expenses added + payments made in the last 60 days.
    const since = nowMs - 60 * DAY_MS;
    const myExpenses60 = expenseRows.filter(
      (e) => e.added_by === userId && new Date(e.created_at).getTime() >= since,
    ).length;
    const myPays60 = mySettlements.filter((s) => new Date(s.created_at).getTime() >= since).length;
    const events = myExpenses60 + myPays60;
    const partPts = Math.round(10 * Math.min(1, events / 6));

    const factors: ScoreFactor[] = [
      {
        key: "ontime",
        label: "On-time settle-ups",
        detail: cycles
          ? `${onTime} of ${cycles} closed on time`
          : "No settle-up deadlines yet — full marks",
        points: onTimePts,
        max: 40,
      },
      {
        key: "speed",
        label: "How fast you pay",
        detail:
          avgLag === null
            ? "No payments yet — starts at 14"
            : `Averages ${avgLag < 1 ? "under a day" : plural(Math.round(avgLag), "day")} after a window opens`,
        points: speedPts,
        max: 20,
      },
      {
        key: "clean",
        label: "Clean charges",
        detail: flagged
          ? `${plural(flagged, "charge")} you added got flagged`
          : "Nothing you added has been flagged",
        points: cleanPts,
        max: 15,
      },
      {
        key: "standing",
        label: "Standing in your groups",
        detail: myRows.length
          ? `Square in ${squareGroups} of ${myRows.length} groups`
          : "Join a group to start earning here",
        points: standingPts,
        max: 15,
      },
      {
        key: "part",
        label: "Pulling your weight",
        detail: events
          ? `${plural(myExpenses60, "expense")} added and ${plural(myPays60, "payment")} in 60 days`
          : "Nothing logged in the last 60 days",
        points: partPts,
        max: 10,
      },

    ];

    const scoreTotal = Math.max(0, Math.min(100, factors.reduce((s, f) => s + f.points, 0)));
    const tips = factors
      .filter((f) => f.points < f.max)
      .sort((a, b) => b.max - b.points - (a.max - a.points))
      .slice(0, 3)
      .map((f) => {
        if (f.key === "ontime") return "Close each settle-up before its due date.";
        if (f.key === "speed") return "Pay within a day of a window opening.";
        if (f.key === "clean") return "Add a receipt so charges don't get flagged.";
        if (f.key === "standing") return "Clear what you owe to get square in every group.";
        return "Log expenses as they happen so your groups stay current.";
      });

    const scoreBreakdown: ScoreBreakdown = {
      score: scoreTotal,
      rating: scoreRating(scoreTotal),
      factors,
      tips,
    };

    /* ---------------- friends ---------------- */

    const friendMap = new Map<string, Friend>();
    const friendUnpaid = new Map<string, boolean>();
    for (const g of groupRows) {
      for (const m of membersByGroup.get(g.id) ?? []) {
        if (m.profile_id === userId) continue;
        const handle =
          m.handle?.trim() || `@${m.display_name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
        const key = handle.replace(/^@/, "").toLowerCase();
        const tie: FriendTie = {
          groupId: g.id,
          group: g.name,
          // Positive = they owe you; negative = you owe them.
          amount: -round2(n(m.balance)),
          paid: m.dues_paid,
        };
        if (!m.dues_paid) friendUnpaid.set(key, true);
        const found = friendMap.get(key);
        if (found) {
          found.ties.push(tie);
          found.net = round2(found.net + tie.amount);
          found.shared += 1;
        } else {
          friendMap.set(key, {
            id: m.id,
            name: m.display_name,
            handle: handle.startsWith("@") ? handle : `@${handle}`,
            avatarKey: m.avatar_key,
            score: 0,
            net: tie.amount,
            shared: 1,
            ties: [tie],
          });
        }
      }
    }
    const friends = [...friendMap.entries()]
      .map(([key, f]) => ({
        ...f,
        // Their score reflects their whole picture across your shared groups.
        score: peerScore(key, !friendUnpaid.get(key), -f.net),
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.name.localeCompare(b.name));

    return {
      me: {
        name: profile?.name ?? "New member",
        handle: profile?.handle ?? "",
        avatarKey: profile?.avatar_key ?? "maya",
        score: scoreTotal,
        onboarded: profile?.onboarded ?? false,
      },
      wallet: {
        available: round2(n(walletRes.data?.available)),
        pending: round2(n(walletRes.data?.pending)),
      },
      totals: {
        owedToYou,
        youOwe,
        net: round2(owedToYou - youOwe),
        activeGroups: groups.filter((g) => g.cycle !== "settled").length,
      },
      groups,
      actionItems,
      recentExpenses,
      groupDetails,
      activityFeed,
      walletTransactions,
      notifications,
      linkedAccounts,
      people,
      peopleBalances,
      spendingMix,
      monthlyRecap: {
        month: new Date().toLocaleDateString("en-US", { month: "long" }),
        total: round2(monthExpenses.reduce((s, e) => s + n(e.total), 0)),
        topCategory: topCategory?.[0] ?? "—",
        topCategoryTotal: round2(topCategory?.[1] ?? 0),
        expenseCount: monthExpenses.length,
      },
      disputes,
      paymentHistory,
      scoreBreakdown,
      friends,
    };
  });

/* ---------------- onboarding ---------------- */

const DEMO_PEOPLE = [
  { name: "Aisha D.", handle: "@aishad", avatar: "a1" },
  { name: "Jordan T.", handle: "@jordant", avatar: "a2" },
  { name: "Priya K.", handle: "@priyak", avatar: "a1" },
  { name: "Sam W.", handle: "@samw", avatar: "a3" },
  { name: "Marcus R.", handle: "@marcusr", avatar: "a2" },
];

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      name: string;
      handle: string;
      avatarKey: string;
      demo: boolean;
      groupName?: string;
      groupKind?: GroupKind;
      coverKey?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const handle = data.handle.trim().replace(/^@?/, "@").toLowerCase();

    await supabase
      .from("profiles")
      .upsert({
        id: userId,
        name: data.name.trim() || "New member",
        handle: handle.length > 1 ? handle : null,
        avatar_key: data.avatarKey,
        onboarded: true,
      })
      .select()
      .maybeSingle();

    const wallet = await supabase.from("wallets").select("*").eq("profile_id", userId).maybeSingle();
    if (!wallet.data) await supabase.from("wallets").insert({ profile_id: userId });

    const accounts = await supabase
      .from("linked_accounts")
      .select("id")
      .eq("profile_id", userId)
      .limit(1);
    if (!accounts.data?.length) {
      await supabase.from("linked_accounts").insert([
        { profile_id: userId, name: "Chase Total Checking", detail: "•••• 4821", kind: "bank", is_primary: true },
      ]);
    }

    if (data.demo) await seedDemo(supabase, userId, data.name.trim() || "You");
    else if (data.groupName?.trim()) {
      await createGroupRows(supabase, userId, {
        name: data.groupName.trim(),
        kind: data.groupKind ?? "split",
        coverKey: data.coverKey ?? "nyc",
        memberNames: [],
        youName: data.name.trim() || "You",
        youAvatar: data.avatarKey,
      });
    }

    return { ok: true };
  });

type Db = { from: (table: string) => any };

async function createGroupRows(
  supabase: Db,
  userId: string,
  opts: {
    name: string;
    kind: GroupKind;
    coverKey: string;
    memberNames: string[];
    youName: string;
    youAvatar: string;
    purpose?: string;
    cycleState?: CycleState;
    cycleLabel?: string;
    progress?: number;
    paymentOpens?: string;
    paymentDue?: string;
    settleMode?: SettleMode;
    settleFrequency?: SettleFrequency | null;
    settleAnchor?: string | null;
    confirmDays?: number;
    multicurrency?: boolean;
    youAdmin?: boolean;
  },
) {
  const group = await supabase
    .from("groups")
    .insert({
      owner_id: userId,
      kind: opts.kind,
      name: opts.name,
      cover_key: opts.coverKey,
      purpose: opts.purpose ?? null,
      cycle_state: opts.cycleState ?? "open",
      cycle_label: opts.cycleLabel ?? "Cycle open",
      progress: opts.progress ?? 6,
      payment_opens: opts.paymentOpens ?? new Date().toISOString().slice(0, 10),
      payment_due: opts.paymentDue ?? null,
      settle_mode: opts.settleMode ?? "anytime",
      settle_frequency: opts.settleFrequency ?? null,
      settle_anchor: opts.settleAnchor ?? null,
      confirm_days: opts.confirmDays ?? 1,
      multicurrency: opts.multicurrency ?? false,
    })
    .select("*")
    .single();

  const groupId = group.data.id as string;

  const rows = [
    {
      group_id: groupId,
      profile_id: userId,
      display_name: opts.youName,
      avatar_key: opts.youAvatar,
      is_admin: opts.youAdmin ?? true,
      dues_paid: true,
      balance: 0,
    },
    ...opts.memberNames.map((name) => {
      const preset = DEMO_PEOPLE.find((p) => p.name === name);
      return {
        group_id: groupId,
        display_name: name,
        handle: preset?.handle ?? null,
        avatar_key: preset?.avatar ?? "a1",
        is_admin: false,
        dues_paid: true,
        balance: 0,
      };
    }),
  ];
  const members = await supabase.from("group_members").insert(rows).select("*");
  return { groupId, members: (members.data ?? []) as any[] };
}

async function seedDemo(supabase: Db, userId: string, youName: string) {
  const existing = await supabase.from("group_members").select("id").eq("profile_id", userId).limit(1);
  if (existing.data?.length) return;

  const today = new Date();
  const day = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    return d.toISOString().slice(0, 10);
  };

  // ADPhi shared wallet group
  const adphi = await createGroupRows(supabase, userId, {
    name: "ADPhi Yale Lax",
    kind: "wallet",
    coverKey: "club",
    memberNames: ["Priya K.", "Marcus R.", "Jordan T.", "Aisha D."],
    youName,
    youAvatar: "maya",
    purpose: "Yale Lax · ADPhi dues",
    cycleState: "settling",
    cycleLabel: "Fall dues close in 12 days",
    progress: 68,
    paymentOpens: day(-20),
    paymentDue: day(-12),
  });
  const adMembers = adphi.members;
  const adYou = adMembers.find((m) => m.profile_id === userId);
  const adLuke = adMembers.find((m) => m.display_name === "Jordan T.");
  await supabase.from("group_members").update({ balance: -290, dues_paid: false }).eq("id", adYou.id);
  await supabase.from("group_members").update({ is_admin: true }).eq("id", adLuke.id);
  await supabase
    .from("group_members")
    .update({ balance: -290, dues_paid: false })
    .eq("id", adMembers.find((m) => m.display_name === "Marcus R.").id);
  await supabase.from("funding_requests").insert([
    {
      group_id: adphi.groupId,
      title: "Social Dues Fall 2026",
      amount: 290,
      due_on: day(-12),
      audience: "All members",
      collected: 290,
      goal: 1450,
    },
    {
      group_id: adphi.groupId,
      title: "Spring formal deposit",
      amount: 65,
      due_on: day(-45),
      audience: "All members",
      collected: 0,
      goal: 325,
    },
  ]);
  await supabase.from("deposits").insert([
    { group_id: adphi.groupId, member_id: adLuke.id, amount: 290, status: "settled", occurred_on: day(4) },
    {
      group_id: adphi.groupId,
      member_id: adMembers.find((m) => m.display_name === "Priya K.").id,
      amount: 0,
      status: "pending",
      occurred_on: day(1),
    },
  ]);
  await supabase.from("expenses").insert([
    {
      group_id: adphi.groupId,
      payer_member_id: adLuke.id,
      title: "Tailgate catering",
      total: 272.5,
      each_amount: 0,
      claim_status: "pending",
      category: "Food",
      spent_on: day(20),
      paid: false,
    },
    {
      group_id: adphi.groupId,
      payer_member_id: adLuke.id,
      title: "Team banners",
      total: 148,
      each_amount: 0,
      claim_status: "approved",
      category: "Fun",
      spent_on: day(26),
      paid: true,
    },
  ]);

  // Yale Club Soccer — shared wallet where you're a regular member
  const soccer = await createGroupRows(supabase, userId, {
    name: "Yale Club Soccer",
    kind: "wallet",
    coverKey: "club",
    memberNames: ["Priya K.", "Sam W.", "Aisha D."],
    youName,
    youAvatar: "maya",
    youAdmin: false,
    purpose: "Season kitty · club soccer",
    cycleState: "open",
    cycleLabel: "Season dues open",
    progress: 45,
    paymentOpens: day(-6),
    paymentDue: day(-9),
  });
  const scMembers = soccer.members;
  const scYou = scMembers.find((m) => m.profile_id === userId);
  const scPriya = scMembers.find((m) => m.display_name === "Priya K.");
  const scSam = scMembers.find((m) => m.display_name === "Sam W.");
  const scAisha = scMembers.find((m) => m.display_name === "Aisha D.");
  await supabase.from("group_members").update({ is_admin: true }).eq("id", scPriya.id);
  await supabase.from("group_members").update({ balance: -85, dues_paid: false }).eq("id", scYou.id);
  await supabase.from("group_members").update({ balance: -85, dues_paid: false }).eq("id", scAisha.id);
  await supabase.from("funding_requests").insert([
    {
      group_id: soccer.groupId,
      title: "Season dues 2026",
      amount: 85,
      due_on: day(-9),
      audience: "All members",
      collected: 170,
      goal: 340,
    },
  ]);
  await supabase.from("deposits").insert([
    { group_id: soccer.groupId, member_id: scPriya.id, amount: 85, status: "settled", occurred_on: day(8) },
    { group_id: soccer.groupId, member_id: scSam.id, amount: 85, status: "settled", occurred_on: day(5) },
  ]);
  await supabase.from("expenses").insert([
    {
      group_id: soccer.groupId,
      payer_member_id: scYou.id,
      title: "Match balls",
      total: 64,
      each_amount: 0,
      category: "Fun",
      spent_on: day(3),
      paid: false,
      claim_status: "pending",
      added_by: userId,
    },
    {
      group_id: soccer.groupId,
      payer_member_id: scSam.id,
      title: "Referee fees",
      total: 120,
      each_amount: 0,
      category: "Other",
      spent_on: day(11),
      paid: true,
      claim_status: "approved",
    },
  ]);

  // Alpine Ski Club (overdue)
  const ski = await createGroupRows(supabase, userId, {
    name: "Alpine Ski Club",
    kind: "split",
    coverKey: "ski",
    memberNames: ["Aisha D.", "Sam W."],
    youName,
    youAvatar: "maya",
    cycleState: "overdue",
    cycleLabel: "Overdue by 4 days",
    progress: 100,
    paymentOpens: day(-20),
    paymentDue: day(4),
  });
  const skiYou = ski.members.find((m) => m.profile_id === userId);
  const skiAisha = ski.members.find((m) => m.display_name === "Aisha D.");
  const skiSam = ski.members.find((m) => m.display_name === "Sam W.");
  await supabase.from("group_members").update({ balance: -201 }).eq("id", skiYou.id);
  await supabase.from("group_members").update({ balance: 156 }).eq("id", skiAisha.id);
  await supabase.from("group_members").update({ balance: 45 }).eq("id", skiSam.id);
  await supabase.from("expenses").insert([
    { group_id: ski.groupId, payer_member_id: skiAisha.id, title: "Lift tickets (3 days)", total: 468, each_amount: 156, category: "Fun", spent_on: day(9) },
    { group_id: ski.groupId, payer_member_id: skiSam.id, title: "Cabin rental", total: 135, each_amount: 45, category: "Stay", spent_on: day(10) },
    { group_id: ski.groupId, payer_member_id: skiYou.id, title: "Gear rental", total: 120, each_amount: 40, category: "Fun", spent_on: day(10) },
  ]);

  // Vegas Trip (they owe you)
  const vegas = await createGroupRows(supabase, userId, {
    name: "Vegas Trip 2026",
    kind: "split",
    coverKey: "vegas",
    memberNames: ["Marcus R.", "Aisha D."],
    youName,
    youAvatar: "maya",
    cycleState: "settling",
    cycleLabel: "Settle window closes in 2 days",
    progress: 82,
    paymentOpens: day(-10),
    paymentDue: day(-2),
  });
  const vYou = vegas.members.find((m) => m.profile_id === userId);
  const vMarcus = vegas.members.find((m) => m.display_name === "Marcus R.");
  const vAisha = vegas.members.find((m) => m.display_name === "Aisha D.");
  await supabase.from("group_members").update({ balance: 38 }).eq("id", vYou.id);
  await supabase.from("group_members").update({ balance: -38 }).eq("id", vMarcus.id);
  await supabase.from("expenses").insert([
    { group_id: vegas.groupId, payer_member_id: vYou.id, title: "Dinner at Nobu", total: 342, each_amount: 114, category: "Food", spent_on: day(2) },
    { group_id: vegas.groupId, payer_member_id: vAisha.id, title: "Aria Hotel (3 nights)", total: 1080, each_amount: 360, category: "Stay", spent_on: day(3) },
    { group_id: vegas.groupId, payer_member_id: vMarcus.id, title: "Airport rides", total: 96, each_amount: 32, category: "Rides", spent_on: day(4) },
  ]);

  // NYC Roommates
  const nyc = await createGroupRows(supabase, userId, {
    name: "NYC Roommates",
    kind: "split",
    coverKey: "nyc",
    memberNames: ["Jordan T.", "Priya K.", "Sam W."],
    youName,
    youAvatar: "maya",
    cycleState: "open",
    cycleLabel: "Opens in 2 days",
    progress: 44,
    paymentOpens: day(2),
    paymentDue: day(-15),
  });
  const nYou = nyc.members.find((m) => m.profile_id === userId);
  const nJordan = nyc.members.find((m) => m.display_name === "Jordan T.");
  const nPriya = nyc.members.find((m) => m.display_name === "Priya K.");
  await supabase.from("group_members").update({ balance: -84.5 }).eq("id", nYou.id);
  await supabase.from("group_members").update({ balance: 76.5 }).eq("id", nJordan.id);
  await supabase.from("group_members").update({ balance: 8 }).eq("id", nPriya.id);
  await supabase.from("expenses").insert([
    { group_id: nyc.groupId, payer_member_id: nJordan.id, title: "Rent share", total: 306, each_amount: 76.5, category: "Stay", spent_on: day(5) },
    { group_id: nyc.groupId, payer_member_id: nPriya.id, title: "Netflix + Hulu bundle", total: 32, each_amount: 8, category: "Fun", spent_on: day(6) },
    { group_id: nyc.groupId, payer_member_id: nYou.id, title: "Whole Foods grocery run", total: 94.62, each_amount: 23.66, category: "Grocery", spent_on: day(8) },
    { group_id: nyc.groupId, payer_member_id: nPriya.id, title: "ConEd electricity", total: 169, each_amount: 42.25, category: "Bills", spent_on: day(12) },
  ]);

  // Office Lunch Club (all even, empty)
  await createGroupRows(supabase, userId, {
    name: "Office Lunch Club",
    kind: "split",
    coverKey: "lunch",
    memberNames: ["Priya K.", "Marcus R."],
    youName,
    youAvatar: "maya",
    cycleState: "settled",
    cycleLabel: "All even",
    progress: 8,
  });

  await supabase.from("wallets").update({ available: 74.54, pending: 0 }).eq("profile_id", userId);
  await supabase.from("wallet_transactions").insert([
    { profile_id: userId, name: "Priya K.", note: "ConEd split", amount: 42.25, occurred_on: day(6) },
    { profile_id: userId, name: "Jordan T.", note: "Rent share", amount: -84.5, occurred_on: day(8) },
    { profile_id: userId, name: "Aisha D.", note: "Nobu dinner", amount: 114, occurred_on: day(9) },
    { profile_id: userId, name: "Marcus R.", note: "Vegas settlement", amount: -38, occurred_on: day(13) },
    { profile_id: userId, name: "Bank transfer", note: "Added money", amount: 150, occurred_on: day(17) },
  ]);
  await supabase.from("linked_accounts").insert([
    { profile_id: userId, name: "Apple Pay", detail: "Visa •••• 3092", kind: "card" },
    { profile_id: userId, name: "Ally Savings", detail: "•••• 7714", kind: "bank" },
  ]);
  await supabase.from("notifications").insert([
    { profile_id: userId, title: "Alpine Ski Club is overdue", body: "Your settle-up was due 4 days ago.", tone: "urgent" },
    { profile_id: userId, title: "Confirm your NYC Roommates split", body: "Jordan closed the cycle — review $84.50.", tone: "warn" },
    { profile_id: userId, title: "Priya K. paid you $42.25", body: "Landed in your Divy wallet.", tone: "good" },
    { profile_id: userId, title: "Vegas Trip 2026 closes in 2 days", body: "Add any missing expenses before then.", tone: "calm", unread: false },
  ]);
  await supabase.from("activity_events").insert([
    { profile_id: userId, group_id: vegas.groupId, kind: "expense", who: "Aisha D.", text: "added an expense in Vegas Trip 2026", amount: -360 },
    { profile_id: userId, group_id: nyc.groupId, kind: "payment", who: "Priya K.", text: "paid you back for the ConEd split", amount: 42.25 },
    { profile_id: userId, group_id: nyc.groupId, kind: "cycle", who: "NYC Roommates", text: "settlement cycle closes in 15 days", amount: null },
    { profile_id: userId, group_id: vegas.groupId, kind: "expense", who: "You", text: "added an expense in Vegas Trip 2026", amount: -342, unread: false },
    { profile_id: userId, group_id: nyc.groupId, kind: "reminder", who: "Jordan T.", text: "sent you a payment reminder in NYC Roommates", amount: -84.5, unread: false },
  ]);
}

/* ---------------- groups ---------------- */

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      name: string;
      kind: GroupKind;
      coverKey: string;
      memberNames: string[];
      purpose?: string;
      settleMode?: SettleMode;
      settleFrequency?: SettleFrequency;
      settleAnchor?: string;
      confirmDays?: number;
      multicurrency?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profile = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    const scheduled = data.settleMode === "scheduled" && !!data.settleAnchor;
    const confirmDays = data.confirmDays ?? 1;
    const window = scheduled ? settleWindow(data.settleAnchor!, confirmDays) : null;
    const created = await createGroupRows(supabase, userId, {
      name: data.name.trim() || "New group",
      kind: data.kind,
      coverKey: data.coverKey,
      memberNames: data.memberNames.filter((x) => x.trim()).map((x) => x.trim()),
      youName: profile.data?.name ?? "You",
      youAvatar: profile.data?.avatar_key ?? "maya",
      cycleLabel: data.kind === "wallet" ? "Dues cycle open" : "Cycle open",
      ...(data.purpose?.trim() ? { purpose: data.purpose.trim() } : {}),
      settleMode: scheduled ? "scheduled" : "anytime",
      settleFrequency: scheduled ? (data.settleFrequency ?? "monthly") : null,
      settleAnchor: scheduled ? data.settleAnchor! : null,
      confirmDays,
      multicurrency: !!data.multicurrency,
      ...(window ? { paymentOpens: window.opens, paymentDue: window.due } : {}),
    });
    await supabase.from("activity_events").insert({
      profile_id: userId,
      group_id: created.groupId,
      kind: "cycle",
      who: data.name.trim() || "New group",
      text: "group created",
      amount: null,
      unread: false,
    });
    return { groupId: created.groupId };
  });

export const joinGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = data.code.trim().toUpperCase();
    const group = await supabase.from("groups").select("id").eq("join_code", code).maybeSingle();
    if (!group.data) return { ok: false as const, error: "No group with that code" };
    const profile = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    await supabase.from("group_members").insert({
      group_id: group.data.id,
      profile_id: userId,
      display_name: profile.data?.name ?? "You",
      avatar_key: profile.data?.avatar_key ?? "maya",
      handle: profile.data?.handle ?? null,
    });
    return { ok: true as const, groupId: group.data.id as string };
  });

export const setGroupArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string; archived: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roster = await supabase
      .from("group_members")
      .select("id, profile_id, balance")
      .eq("group_id", data.groupId);
    const rows = roster.data ?? [];
    if (!rows.some((m) => m.profile_id === userId)) {
      return { ok: false as const, error: "You're not in this group" };
    }
    if (data.archived) {
      const open = rows.some((m) => Math.abs(Number(m.balance ?? 0)) > 0.005);
      if (open) {
        return { ok: false as const, error: "Everyone has to be settled up before archiving" };
      }
    }
    await supabase.from("groups").update({ archived: data.archived }).eq("id", data.groupId);
    return { ok: true as const };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => data)
  .handler(async ({ data, context }) => {
    await context.supabase.from("groups").delete().eq("id", data.groupId);
    return { ok: true };
  });

/* ---------------- expenses ---------------- */

export const addExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      groupId: string;
      title: string;
      total: number;
      category: string;
      payerMemberId: string | null;
      receiptKey?: string | null;
      recurFreq?: RecurFreq | null;
      /** Exact amount each member owes; omit for an even split. */
      shares?: Record<string, number> | null;
      /** Receipt line items with who shared each one. */
      items?: { name: string; amount: number; memberIds: string[] }[] | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const members = await supabase.from("group_members").select("*").eq("group_id", data.groupId);
    const roster = members.data ?? [];
    if (!roster.length) return { ok: false as const, error: "Group not found" };
    const mine = roster.find((m: any) => m.profile_id === userId);
    const payerId: string = data.payerMemberId ?? mine?.id ?? (roster[0] as any).id;
    const groupRow = await supabase
      .from("groups")
      .select("name, kind")
      .eq("id", data.groupId)
      .maybeSingle();
    const isWallet = groupRow.data?.kind === "wallet";
    const each = isWallet ? 0 : round2(data.total / roster.length);
    // custom shares (itemized or manual) override the even split
    const rawShares = !isWallet && data.shares ? data.shares : null;
    const shares: Record<string, number> | null = rawShares
      ? Object.fromEntries(
          roster.map((m: any) => [m.id, round2(Math.max(0, Number(rawShares[m.id] ?? 0)))]),
        )
      : null;


    const expense = await supabase
      .from("expenses")
      .insert({
        group_id: data.groupId,
        payer_member_id: payerId,
        title: data.title.trim() || "Expense",
        total: round2(data.total),
        each_amount: each,
        category: data.category,
        added_by: userId,
        paid: !isWallet,
        claim_status: isWallet ? "pending" : null,
        receipt_key: data.receiptKey ?? null,
        recur_freq: data.recurFreq ?? null,
        recur_next: data.recurFreq ? advance(isoDay(new Date()), data.recurFreq, 1) : null,
        items: data.items ?? null,
        shares,
      })
      .select("id")
      .single();

    // split groups move balances; wallet groups wait for an admin to reimburse
    if (!isWallet) {
      if (shares) {
        await applyShareBalances(supabase, data.groupId, payerId, round2(data.total), shares, 1);
      } else {
        for (const m of roster) {
          const delta = m.id === payerId ? round2(data.total - each) : -each;
          await supabase
            .from("group_members")
            .update({ balance: round2(Number(m.balance ?? 0) + delta) })
            .eq("id", m.id);
        }
      }
    }

    const groupName = groupRow.data?.name ?? "a group";
    const payer = roster.find((m: any) => m.id === payerId);
    await supabase.from("activity_events").insert({
      profile_id: userId,
      group_id: data.groupId,
      kind: "expense",
      who: payer?.profile_id === userId ? "You" : (payer?.display_name ?? "Someone"),
      text: isWallet
        ? `asked to be reimbursed from ${groupName}`
        : `added an expense in ${groupName}`,
      amount: isWallet ? -round2(data.total) : -round2(each),
    });

    if (isWallet) {
      const admins = roster.filter((m: any) => m.is_admin && m.profile_id);
      for (const a of admins) {
        await supabase.from("notifications").insert({
          profile_id: a.profile_id as string,
          title: "Reimbursement to review",
          body: `${payer?.display_name ?? "A member"} paid $${round2(data.total).toFixed(2)} for ${data.title.trim() || "an expense"} in ${groupName}.`,
          tone: "warn",
        });
      }
    }

    return { ok: true as const, expenseId: expense.data?.id as string };
  });

/** Edit an expense: reverse the old split, apply the new one. */
export const updateExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      expenseId: string;
      title: string;
      total: number;
      category: string;
      payerMemberId: string | null;
      spentOn: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const current = await supabase.from("expenses").select("*").eq("id", data.expenseId).maybeSingle();
    if (!current.data) return { ok: false as const, error: "Expense not found" };
    const groupId = current.data.group_id as string;

    const { isAdmin } = await adminMember(supabase, groupId, context.userId);
    if (!isAdmin && current.data.added_by !== context.userId) {
      return {
        ok: false as const,
        error: "Only a group admin or the person who added this can edit it",
      };
    }

    const roster = await supabase.from("group_members").select("id").eq("group_id", groupId);
    const count = (roster.data ?? []).length || 1;

    // reverse the existing split (itemized expenses reverse by their stored shares)
    const oldShares = (current.data.shares ?? null) as Record<string, number> | null;
    if (oldShares) {
      await applyShareBalances(
        supabase,
        groupId,
        current.data.payer_member_id,
        round2(Number(current.data.total ?? 0)),
        oldShares,
        -1,
      );
    } else {
      await applyExpenseBalances(
        supabase,
        groupId,
        current.data.payer_member_id,
        round2(Number(current.data.total ?? 0)),
        round2(Number(current.data.each_amount ?? 0)),
        -1,
      );
    }

    const total = round2(Math.max(0, data.total));
    const each = round2(total / count);
    const payerId = data.payerMemberId ?? current.data.payer_member_id ?? null;

    await supabase
      .from("expenses")
      .update({
        title: data.title.trim() || "Expense",
        total,
        each_amount: each,
        category: data.category,
        payer_member_id: payerId,
        spent_on: data.spentOn,
        // editing the amount replaces any itemized split with an even one
        items: null,
        shares: null,
      })
      .eq("id", data.expenseId);

    await applyExpenseBalances(supabase, groupId, payerId, total, each, 1);
    return { ok: true as const, groupId };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { expenseId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const expense = await supabase.from("expenses").select("*").eq("id", data.expenseId).maybeSingle();
    if (!expense.data) return { ok: false as const };
    const members = await supabase.from("group_members").select("*").eq("group_id", expense.data.group_id);
    const roster = members.data ?? [];
    const each = Number(expense.data.each_amount ?? 0);
    const total = Number(expense.data.total ?? 0);
    const stored = (expense.data.shares ?? null) as Record<string, number> | null;
    for (const m of roster) {
      const owed = stored ? round2(Number(stored[m.id] ?? 0)) : each;
      const delta = m.id === expense.data.payer_member_id ? -(total - owed) : owed;
      await supabase
        .from("group_members")
        .update({ balance: round2(Number(m.balance ?? 0) + delta) })
        .eq("id", m.id);
    }
    await supabase.from("expenses").delete().eq("id", data.expenseId);
    return { ok: true as const, groupId: expense.data.group_id as string };
  });

/* ---------------- settling ---------------- */

export const settleGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      groupId: string;
      amount: number;
      source: string;
      kind?: "settle" | "dues";
      requestId?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const amount = round2(Math.max(0, data.amount));
    const members = await supabase.from("group_members").select("*").eq("group_id", data.groupId);
    const roster = members.data ?? [];
    const mine = roster.find((m: any) => m.profile_id === userId);
    if (!mine) return { ok: false as const, error: "Not a member" };

    const newBalance = round2(Number(mine.balance ?? 0) + amount);
    const isDues = data.kind === "dues";
    await supabase
      .from("group_members")
      .update({ balance: newBalance, dues_paid: isDues ? newBalance >= 0 : mine.dues_paid })
      .eq("id", mine.id);

    // pay down creditors in the group
    let remaining = amount;
    for (const m of roster) {
      if (m.id === mine.id || remaining <= 0) continue;
      const credit = Number(m.balance ?? 0);
      if (credit <= 0) continue;
      const applied = Math.min(credit, remaining);
      remaining = round2(remaining - applied);
      await supabase
        .from("group_members")
        .update({ balance: round2(credit - applied) })
        .eq("id", m.id);
    }

    if (data.source === "wallet") {
      const wallet = await supabase.from("wallets").select("*").eq("profile_id", userId).maybeSingle();
      await supabase
        .from("wallets")
        .update({ available: round2(Number(wallet.data?.available ?? 0) - amount) })
        .eq("profile_id", userId);
    }

    const group = await supabase.from("groups").select("*").eq("id", data.groupId).maybeSingle();
    const groupName = group.data?.name ?? "group";

    if (isDues) {
      await supabase.from("deposits").insert({
        group_id: data.groupId,
        member_id: mine.id,
        amount,
        status: "settled",
        request_id: data.requestId ?? null,
      });
      const requests = await supabase
        .from("funding_requests")
        .select("*")
        .eq("group_id", data.groupId)
        .order("created_at");
      const list = requests.data ?? [];
      const fr = (data.requestId ? list.find((r: any) => r.id === data.requestId) : null) ?? list[0];
      if (fr) {
        await supabase
          .from("funding_requests")
          .update({ collected: round2(Number(fr.collected ?? 0) + amount) })
          .eq("id", fr.id);
      }
    }

    const refreshed = await supabase.from("group_members").select("balance").eq("group_id", data.groupId);
    const allEven = (refreshed.data ?? []).every((m: any) => Math.abs(Number(m.balance ?? 0)) < 0.01);
    if (allEven) {
      await supabase
        .from("groups")
        .update({ cycle_state: "settled", cycle_label: "All even", progress: 100 })
        .eq("id", data.groupId);
    }

    await supabase.from("settlements").insert({
      profile_id: userId,
      group_id: data.groupId,
      amount,
      kind: isDues ? "dues" : "settle",
      source: data.source,
    });
    await supabase.from("wallet_transactions").insert({
      profile_id: userId,
      name: groupName,
      note: isDues ? "Dues payment" : "Settle up",
      amount: -amount,
    });
    await supabase.from("activity_events").insert({
      profile_id: userId,
      group_id: data.groupId,
      kind: "payment",
      who: "You",
      text: isDues ? `paid dues in ${groupName}` : `settled up in ${groupName}`,
      amount: -amount,
      unread: false,
    });

    return { ok: true as const, allEven };
  });

export const remindMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string; memberId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const member = await supabase
      .from("group_members")
      .select("display_name, profile_id, balance")
      .eq("id", data.memberId)
      .maybeSingle();
    const group = await supabase.from("groups").select("name").eq("id", data.groupId).maybeSingle();
    const me = await supabase.from("profiles").select("name").eq("id", userId).maybeSingle();

    await supabase
      .from("group_members")
      .update({ last_reminded_at: new Date().toISOString() })
      .eq("id", data.memberId);

    if (member.data?.profile_id) {
      const owed = Math.abs(round2(n(member.data.balance)));
      await supabase.from("notifications").insert({
        profile_id: member.data.profile_id,
        title: `${me.data?.name ?? "Someone"} nudged you`,
        body: owed
          ? `You still owe $${owed.toFixed(2)} in ${group.data?.name ?? "a group"}.`
          : `Check in on ${group.data?.name ?? "your group"}.`,
        tone: "warn",
      });
    }
    await supabase.from("activity_events").insert({
      profile_id: userId,
      group_id: data.groupId,
      kind: "reminder",
      who: "You",
      text: `reminded ${member.data?.display_name ?? "a member"} in ${group.data?.name ?? "a group"}`,
      amount: null,
      unread: false,
    });
    return { ok: true };
  });

export const createFundingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { groupId: string; title: string; amount: number; audience: string; dueInDays: number }) =>
      data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const members = await supabase
      .from("group_members")
      .select("id, profile_id, is_admin")
      .eq("group_id", data.groupId);
    const mine = (members.data ?? []).find((m) => m.profile_id === userId);
    if (!mine?.is_admin) return { ok: false as const, error: "Only a group admin can do that" };
    const count = members.data?.length ?? 1;
    const due = new Date();
    due.setDate(due.getDate() + data.dueInDays);
    await supabase.from("funding_requests").insert({
      group_id: data.groupId,
      title: data.title.trim() || "Funding request",
      amount: round2(data.amount),
      audience: data.audience,
      due_on: due.toISOString().slice(0, 10),
      goal: round2(data.amount * count),
      collected: 0,
    });
    await supabase.from("activity_events").insert({
      profile_id: userId,
      group_id: data.groupId,
      kind: "cycle",
      who: "You",
      text: `created the funding request "${data.title.trim()}"`,
      amount: null,
      unread: false,
    });
    return { ok: true };
  });

/* ---------------- wallet ---------------- */

export const walletTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      direction: "add" | "withdraw";
      amount: number;
      accountName: string;
      instant: boolean;
      fee: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const amount = round2(Math.max(0, data.amount));
    const wallet = await supabase.from("wallets").select("*").eq("profile_id", userId).maybeSingle();
    const available = Number(wallet.data?.available ?? 0);
    const delta = data.direction === "add" ? amount : -(amount + round2(data.fee));
    await supabase
      .from("wallets")
      .update({ available: round2(available + delta) })
      .eq("profile_id", userId);
    await supabase.from("wallet_transactions").insert({
      profile_id: userId,
      name: data.accountName,
      note: data.direction === "add" ? "Added money" : "Withdrawal",
      amount: round2(delta),
    });
    await supabase.from("activity_events").insert({
      profile_id: userId,
      kind: "payment",
      who: "You",
      text: data.direction === "add" ? "added money to your wallet" : "withdrew money to your bank",
      amount: round2(delta),
      unread: false,
    });
    return { ok: true };
  });

export const walletSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; amount: number; note: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const amount = round2(Math.max(0, data.amount));
    const wallet = await supabase.from("wallets").select("*").eq("profile_id", userId).maybeSingle();
    await supabase
      .from("wallets")
      .update({ available: round2(Number(wallet.data?.available ?? 0) - amount) })
      .eq("profile_id", userId);
    await supabase.from("wallet_transactions").insert({
      profile_id: userId,
      name: data.name,
      note: data.note.trim() || "Sent money",
      amount: -amount,
    });
    await supabase.from("activity_events").insert({
      profile_id: userId,
      kind: "payment",
      who: "You",
      text: `sent money to ${data.name}`,
      amount: -amount,
      unread: false,
    });
    return { ok: true };
  });

export const addLinkedAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; detail: string; kind: "bank" | "card" }) => data)
  .handler(async ({ data, context }) => {
    await context.supabase.from("linked_accounts").insert({
      profile_id: context.userId,
      name: data.name.trim() || "New account",
      detail: data.detail.trim(),
      kind: data.kind,
    });
    return { ok: true };
  });

export const setPrimaryAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { accountId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("linked_accounts").update({ is_primary: false }).eq("profile_id", userId);
    await supabase.from("linked_accounts").update({ is_primary: true }).eq("id", data.accountId);
    return { ok: true };
  });

export const removeLinkedAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { accountId: string }) => data)
  .handler(async ({ data, context }) => {
    await context.supabase.from("linked_accounts").delete().eq("id", data.accountId);
    return { ok: true };
  });

/* ---------------- inbox ---------------- */

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("notifications")
      .update({ unread: false })
      .eq("profile_id", context.userId)
      .eq("unread", true);
    return { ok: true };
  });

export const markActivityRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("activity_events")
      .update({ unread: false })
      .eq("profile_id", context.userId)
      .eq("unread", true);
    return { ok: true };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name?: string; handle?: string; avatarKey?: string }) => data)
  .handler(async ({ data, context }) => {
    const patch: { name?: string; handle?: string | null; avatar_key?: string } = {};
    if (data.name !== undefined) patch['name'] = data.name.trim() || "New member";
    if (data.handle !== undefined) {
      const handle = data.handle.trim().replace(/^@?/, "@").toLowerCase();
      patch['handle'] = handle.length > 1 ? handle : null;
    }
    if (data.avatarKey !== undefined) patch['avatar_key'] = data.avatarKey;
    await context.supabase.from("profiles").update(patch).eq("id", context.userId);
    return { ok: true };
  });

/* ---------------- admin-only group actions ---------------- */

async function adminMember(supabase: any, groupId: string, userId: string) {
  const roster = await supabase.from("group_members").select("*").eq("group_id", groupId);
  const mine = (roster.data ?? []).find((m: any) => m.profile_id === userId) ?? null;
  return { mine, isAdmin: !!mine?.is_admin };
}

/** Admin closes the expense window and opens the payment window. */
export const startSettleUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await adminMember(supabase, data.groupId, userId);
    if (!isAdmin) return { ok: false as const, error: "Only a group admin can start a settle-up" };

    const group = await supabase.from("groups").select("*").eq("id", data.groupId).maybeSingle();
    const confirmDays = Number(group.data?.confirm_days ?? 1);
    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + Math.max(1, confirmDays));
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    await supabase
      .from("groups")
      .update({
        cycle_state: "settling",
        cycle_label: `Pay by ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        payment_opens: iso(today),
        payment_due: iso(due),
      })
      .eq("id", data.groupId);

    // fresh window: everyone who still owes starts as unpaid
    const roster = await supabase
      .from("group_members")
      .select("id, balance, dues_paid")
      .eq("group_id", data.groupId);
    for (const m of roster.data ?? []) {
      const square = Math.abs(Number(m.balance ?? 0)) < 0.005;
      if (m.dues_paid !== square) {
        await supabase.from("group_members").update({ dues_paid: square }).eq("id", m.id);
      }
    }

    await supabase.from("activity_events").insert({
      profile_id: userId,
      group_id: data.groupId,
      kind: "cycle",
      who: "You",
      text: "started a settle-up for the group",
      amount: null,
      unread: false,
    });
    return { ok: true as const };
  });

/** A member asks the group's admins to open a settle-up window. */
export const requestSettleUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roster = await supabase.from("group_members").select("*").eq("group_id", data.groupId);
    const rows = roster.data ?? [];
    const mine = rows.find((m: any) => m.profile_id === userId);
    if (!mine) return { ok: false as const, error: "You're not in this group" };

    const group = await supabase.from("groups").select("name").eq("id", data.groupId).maybeSingle();
    const groupName = group.data?.name ?? "your group";
    const admins = rows.filter((m: any) => m.is_admin && m.profile_id && m.profile_id !== userId);

    for (const a of admins) {
      await supabase.from("notifications").insert({
        profile_id: a.profile_id as string,
        title: `${mine.display_name} wants to settle up`,
        body: `Start a settle-up in ${groupName} so everyone can pay.`,
        tone: "calm",
        unread: true,
      });
    }
    await supabase.from("activity_events").insert({
      profile_id: userId,
      group_id: data.groupId,
      kind: "cycle",
      who: "You",
      text: `asked an admin to start a settle-up in ${groupName}`,
      amount: null,
      unread: false,
    });
    return { ok: true as const, count: admins.length };
  });

/** Admin edits group details and the settle-up window. */
export const updateGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      groupId: string;
      name?: string;
      purpose?: string | null;
      coverKey?: string;
      settleMode?: SettleMode;
      settleFrequency?: SettleFrequency | null;
      settleAnchor?: string | null;
      confirmDays?: number;
      multicurrency?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await adminMember(supabase, data.groupId, userId);
    if (!isAdmin) return { ok: false as const, error: "Only a group admin can edit the group" };

    const patch: any = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) return { ok: false as const, error: "Give the group a name" };
      patch["name"] = name;
    }
    if (data.purpose !== undefined) patch["purpose"] = data.purpose?.trim() || null;
    if (data.coverKey !== undefined) patch["cover_key"] = data.coverKey;
    if (data.multicurrency !== undefined) patch["multicurrency"] = !!data.multicurrency;

    if (data.settleMode !== undefined) {
      const scheduled = data.settleMode === "scheduled" && !!data.settleAnchor;
      patch["settle_mode"] = scheduled ? "scheduled" : "anytime";
      patch["settle_frequency"] = scheduled ? (data.settleFrequency ?? "monthly") : null;
      patch["settle_anchor"] = scheduled ? data.settleAnchor : null;
      const confirmDays = Math.max(1, Number(data.confirmDays ?? 1));
      patch["confirm_days"] = confirmDays;
      if (scheduled && data.settleAnchor) {
        const w = settleWindow(data.settleAnchor, confirmDays);
        patch["payment_opens"] = w.opens;
        patch["payment_due"] = w.due;
      }
    } else if (data.confirmDays !== undefined) {
      patch["confirm_days"] = Math.max(1, Number(data.confirmDays));
    }

    await supabase.from("groups").update(patch).eq("id", data.groupId);
    return { ok: true as const };
  });

/** Admin changes the group cover photo. */
export const setGroupCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string; coverKey: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await adminMember(supabase, data.groupId, userId);
    if (!isAdmin) return { ok: false as const, error: "Only a group admin can change the photo" };
    await supabase.from("groups").update({ cover_key: data.coverKey }).eq("id", data.groupId);
    return { ok: true as const };
  });

/** Admin moves money out of the shared group wallet into their own Divy wallet. */
export const groupWalletTransferOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      groupId: string;
      amount: number;
      note?: string;
      destination?: "wallet" | "bank";
      accountId?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { mine, isAdmin } = await adminMember(supabase, data.groupId, userId);
    if (!isAdmin) return { ok: false as const, error: "Only a wallet admin can transfer money out" };
    const toBank = data.destination === "bank";

    const amount = round2(Math.max(0, data.amount));
    if (amount <= 0) return { ok: false as const, error: "Enter an amount" };

    const deposits = await supabase
      .from("deposits")
      .select("amount, status")
      .eq("group_id", data.groupId);
    const available = round2(
      (deposits.data ?? [])
        .filter((d: any) => d.status !== "pending")
        .reduce((s: number, d: any) => s + Number(d.amount ?? 0), 0),
    );
    if (amount > available) return { ok: false as const, error: "More than the wallet has" };

    let bankName = "your bank account";
    if (toBank) {
      const accounts = await supabase
        .from("linked_accounts")
        .select("*")
        .eq("profile_id", userId)
        .order("created_at");
      const list = accounts.data ?? [];
      if (!list.length) return { ok: false as const, error: "Link a bank account first" };
      const picked =
        list.find((a: any) => a.id === data.accountId) ??
        list.find((a: any) => a.is_primary) ??
        list[0]!;
      bankName = `${picked.name} ${picked.detail ?? ""}`.trim();
    }

    await supabase.from("deposits").insert({
      group_id: data.groupId,
      member_id: mine?.id ?? null,
      amount: -amount,
      status: "settled",
    });

    if (!toBank) {
      const wallet = await supabase
        .from("wallets")
        .select("*")
        .eq("profile_id", userId)
        .maybeSingle();
      await supabase
        .from("wallets")
        .update({ available: round2(Number(wallet.data?.available ?? 0) + amount) })
        .eq("profile_id", userId);
    }

    const group = await supabase.from("groups").select("name").eq("id", data.groupId).maybeSingle();
    await supabase.from("wallet_transactions").insert({
      profile_id: userId,
      name: group.data?.name ?? "Group wallet",
      note: toBank ? `Sent to ${bankName}` : data.note?.trim() || "Transfer from group wallet",
      amount: toBank ? 0 : amount,
    });
    await supabase.from("activity_events").insert({
      profile_id: userId,
      group_id: data.groupId,
      kind: "payment",
      who: "You",
      text: toBank
        ? `sent group wallet money to ${bankName}`
        : "transferred money out of the group wallet",
      amount,
      unread: false,
    });
    await supabase.from("settlements").insert({
      profile_id: userId,
      group_id: data.groupId,
      amount,
      kind: "settle",
      source: toBank ? "bank" : "wallet",
    });
    return { ok: true as const, toBank, bankName };
  });

/** Admin edits a funding request's title, amount or due date. */
export const updateFundingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      groupId: string;
      requestId: string;
      title?: string;
      amount?: number;
      dueOn?: string | null;
      audience?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await adminMember(supabase, data.groupId, userId);
    if (!isAdmin) return { ok: false as const, error: "Only a group admin can do that" };
    const roster = await supabase.from("group_members").select("id").eq("group_id", data.groupId);
    const count = roster.data?.length ?? 1;
    const patch: {
      title?: string;
      amount?: number;
      goal?: number;
      due_on?: string | null;
      audience?: string;
    } = {};
    if (data.title !== undefined && data.title.trim()) patch['title'] = data.title.trim();
    if (data.amount !== undefined) {
      const amount = round2(Math.max(0, data.amount));
      patch['amount'] = amount;
      patch['goal'] = round2(amount * count);
    }
    if (data.dueOn !== undefined) patch['due_on'] = data.dueOn || null;
    if (data.audience !== undefined && data.audience.trim()) patch['audience'] = data.audience.trim();
    if (Object.keys(patch).length === 0) return { ok: true as const };
    await supabase.from("funding_requests").update(patch).eq("id", data.requestId);
    return { ok: true as const };
  });

/** A member removes themselves from a group — only when they're fully square. */
export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roster = await supabase.from("group_members").select("*").eq("group_id", data.groupId);
    const list = roster.data ?? [];
    const mine = list.find((m: any) => m.profile_id === userId);
    if (!mine) return { ok: false as const, error: "You're not in this group" };
    if (Math.abs(Number(mine.balance ?? 0)) > 0.005) {
      return {
        ok: false as const,
        error: "Settle your balance to $0.00 before you leave this group",
      };
    }
    if (!mine.dues_paid) {
      return { ok: false as const, error: "You still have a payment due in this group" };
    }
    const claims = await supabase
      .from("expenses")
      .select("id")
      .eq("group_id", data.groupId)
      .eq("payer_member_id", mine.id)
      .eq("claim_status", "pending");
    if ((claims.data ?? []).length > 0) {
      return { ok: false as const, error: "You have a reimbursement still waiting on an admin" };
    }
    const others = list.filter((m: any) => m.id !== mine.id);
    if (mine.is_admin && others.length > 0 && !others.some((m: any) => m.is_admin)) {
      return { ok: false as const, error: "Make someone else an admin before you leave" };
    }
    const group = await supabase.from("groups").select("name, owner_id").eq("id", data.groupId).maybeSingle();
    if (group.data?.owner_id === userId && others.length > 0) {
      return { ok: false as const, error: "Pass admin to someone else first — you created this group" };
    }
    await supabase.from("group_members").delete().eq("id", mine.id);
    await supabase.from("activity_events").insert({
      profile_id: userId,
      group_id: null,
      kind: "cycle",
      who: "You",
      text: `left ${group.data?.name ?? "a group"}`,
      amount: null,
      unread: false,
    });
    return { ok: true as const };
  });

/** Admin removes a funding request. */
export const deleteFundingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string; requestId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await adminMember(supabase, data.groupId, userId);
    if (!isAdmin) return { ok: false as const, error: "Only a group admin can do that" };
    await supabase.from("funding_requests").delete().eq("id", data.requestId);
    return { ok: true as const };
  });

/* ---------------- reminders ---------------- */

/** Nudge everyone in a group who still owes money. */
export const nudgeGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roster = await supabase.from("group_members").select("*").eq("group_id", data.groupId);
    const list = roster.data ?? [];
    const mine = list.find((m: any) => m.profile_id === userId);
    if (!mine) return { ok: false as const, error: "Not a member", count: 0 };

    const group = await supabase.from("groups").select("name").eq("id", data.groupId).maybeSingle();
    const me = await supabase.from("profiles").select("name").eq("id", userId).maybeSingle();
    const nowMs = Date.now();
    const behind = list.filter(
      (m: any) =>
        m.id !== mine.id &&
        Number(m.balance ?? 0) < 0 &&
        (!m.last_reminded_at || nowMs - new Date(m.last_reminded_at).getTime() > 12 * 3600 * 1000),
    );

    for (const m of behind) {
      await supabase
        .from("group_members")
        .update({ last_reminded_at: new Date().toISOString() })
        .eq("id", m.id);
      if (!m.profile_id) continue;
      await supabase.from("notifications").insert({
        profile_id: m.profile_id,
        title: `Reminder from ${me.data?.name ?? "your group"}`,
        body: `You owe $${Math.abs(round2(n(m.balance))).toFixed(2)} in ${group.data?.name ?? "a group"}.`,
        tone: "warn",
      });
    }

    await supabase.from("activity_events").insert({
      profile_id: userId,
      group_id: data.groupId,
      kind: "reminder",
      who: "You",
      text: behind.length
        ? `nudged ${behind.length} ${behind.length === 1 ? "person" : "people"} in ${group.data?.name ?? "a group"}`
        : `checked reminders in ${group.data?.name ?? "a group"}`,
      amount: null,
      unread: false,
    });

    return { ok: true as const, count: behind.length };
  });

/* ---------------- receipts & repeating ---------------- */

export const setExpenseReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { expenseId: string; receiptKey: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase
      .from("expenses")
      .update({ receipt_key: data.receiptKey })
      .eq("id", data.expenseId);
    return { ok: true as const };
  });

export const setExpenseRepeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { expenseId: string; recurFreq: RecurFreq | null }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase
      .from("expenses")
      .update({
        recur_freq: data.recurFreq,
        recur_next: data.recurFreq ? advance(isoDay(new Date()), data.recurFreq, 1) : null,
      })
      .eq("id", data.expenseId);
    return { ok: true as const };
  });

/* ---------------- disputes ---------------- */

export const raiseDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string; expenseId: string; reason: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { mine } = await adminMember(supabase, data.groupId, userId);
    if (!mine) return { ok: false as const, error: "Not a member" };

    const open = await supabase
      .from("disputes")
      .select("id")
      .eq("expense_id", data.expenseId)
      .eq("status", "open")
      .maybeSingle();
    if (open.data) return { ok: false as const, error: "This charge is already being reviewed" };

    await supabase.from("disputes").insert({
      group_id: data.groupId,
      expense_id: data.expenseId,
      raised_by: userId,
      raised_name: mine.display_name ?? "Member",
      reason: data.reason.trim() || "No reason given",
    });

    const roster = await supabase
      .from("group_members")
      .select("profile_id, is_admin")
      .eq("group_id", data.groupId);
    const expense = await supabase
      .from("expenses")
      .select("title")
      .eq("id", data.expenseId)
      .maybeSingle();
    for (const m of roster.data ?? []) {
      if (!m.is_admin || !m.profile_id) continue;
      await supabase.from("notifications").insert({
        profile_id: m.profile_id,
        title: "A charge was flagged",
        body: `${mine.display_name ?? "A member"} flagged "${expense.data?.title ?? "an expense"}" for review.`,
        tone: "urgent",
      });
    }

    await supabase.from("activity_events").insert({
      profile_id: userId,
      group_id: data.groupId,
      kind: "expense",
      who: "You",
      text: `flagged "${expense.data?.title ?? "an expense"}" for review`,
      amount: null,
      unread: false,
    });

    return { ok: true as const };
  });

/** Admin resolves a flagged charge: "remove" reverses it, "keep" dismisses it. */
export const resolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { disputeId: string; action: "remove" | "keep"; note?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const dispute = await supabase
      .from("disputes")
      .select("*")
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!dispute.data) return { ok: false as const, error: "Not found" };
    const { isAdmin } = await adminMember(supabase, dispute.data.group_id, userId);
    if (!isAdmin) return { ok: false as const, error: "Only a group admin can settle a dispute" };

    if (data.action === "remove" && dispute.data.expense_id) {
      const expense = await supabase
        .from("expenses")
        .select("*")
        .eq("id", dispute.data.expense_id)
        .maybeSingle();
      if (expense.data) {
        await applyExpenseBalances(
          supabase,
          expense.data.group_id,
          expense.data.payer_member_id,
          round2(n(expense.data.total)),
          round2(n(expense.data.each_amount)),
          -1,
        );
        await supabase.from("expenses").delete().eq("id", expense.data.id);
      }
    }

    await supabase
      .from("disputes")
      .update({
        status: data.action === "remove" ? "resolved" : "rejected",
        resolution:
          data.note?.trim() ||
          (data.action === "remove" ? "Charge removed and balances fixed" : "Charge kept as is"),
      })
      .eq("id", data.disputeId);

    if (dispute.data.raised_by) {
      await supabase.from("notifications").insert({
        profile_id: dispute.data.raised_by,
        title: data.action === "remove" ? "Your flag was accepted" : "Your flag was reviewed",
        body:
          data.action === "remove"
            ? "The charge was removed and balances were fixed."
            : "An admin kept the charge as is.",
        tone: data.action === "remove" ? "good" : "calm",
      });
    }

    return { ok: true as const };
  });

/* ---------------- admin transfer ---------------- */

/** Hand admin over to another member. */
export const transferAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { groupId: string; memberId: string; keepBoth?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { mine, isAdmin } = await adminMember(supabase, data.groupId, userId);
    if (!isAdmin || !mine) return { ok: false as const, error: "Only an admin can pass this on" };
    if (data.memberId === mine.id) return { ok: false as const, error: "You are already the admin" };

    await supabase.from("group_members").update({ is_admin: true }).eq("id", data.memberId);
    if (!data.keepBoth) {
      await supabase.from("group_members").update({ is_admin: false }).eq("id", mine.id);
    }

    const target = await supabase
      .from("group_members")
      .select("display_name, profile_id")
      .eq("id", data.memberId)
      .maybeSingle();
    const group = await supabase.from("groups").select("name").eq("id", data.groupId).maybeSingle();

    if (target.data?.profile_id) {
      await supabase.from("notifications").insert({
        profile_id: target.data.profile_id,
        title: "You are now a group admin",
        body: `You can start settle-ups in ${group.data?.name ?? "the group"}.`,
        tone: "good",
      });
    }
    await supabase.from("activity_events").insert({
      profile_id: userId,
      group_id: data.groupId,
      kind: "cycle",
      who: "You",
      text: `made ${target.data?.display_name ?? "a member"} an admin`,
      amount: null,
      unread: false,
    });

    return { ok: true as const };
  });


// Wallet groups: a member fronts a cost, an admin approves the payout from the
// shared wallet (or declines it).
export const resolveReimbursement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { expenseId: string; action: "approve" | "decline" }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const current = await supabase
      .from("expenses")
      .select("*")
      .eq("id", data.expenseId)
      .maybeSingle();
    if (!current.data) return { ok: false as const, error: "Expense not found" };
    const groupId = current.data.group_id as string;
    const { isAdmin } = await adminMember(supabase, groupId, userId);
    if (!isAdmin) return { ok: false as const, error: "Only a wallet admin can approve this" };
    if (current.data.claim_status !== "pending") {
      return { ok: false as const, error: "Already reviewed" };
    }

    const amount = round2(Number(current.data.total ?? 0));
    const payer = current.data.payer_member_id
      ? (
          await supabase
            .from("group_members")
            .select("*")
            .eq("id", current.data.payer_member_id)
            .maybeSingle()
        ).data
      : null;

    if (data.action === "decline") {
      await supabase
        .from("expenses")
        .update({ claim_status: "declined", paid: false })
        .eq("id", data.expenseId);
      if (payer?.profile_id) {
        await supabase.from("notifications").insert({
          profile_id: payer.profile_id,
          title: "Reimbursement declined",
          body: `An admin declined the $${amount.toFixed(2)} reimbursement for ${current.data.title}.`,
          tone: "warn",
        });
      }
      return { ok: true as const, groupId };
    }

    const deposits = await supabase.from("deposits").select("amount, status").eq("group_id", groupId);
    const available = round2(
      (deposits.data ?? [])
        .filter((d: any) => d.status !== "pending")
        .reduce((sum: number, d: any) => sum + Number(d.amount ?? 0), 0),
    );
    if (amount > available) {
      return { ok: false as const, error: "The wallet doesn't have enough to cover this" };
    }

    await supabase.from("deposits").insert({
      group_id: groupId,
      member_id: current.data.payer_member_id ?? null,
      amount: -amount,
      status: "settled",
    });
    await supabase
      .from("expenses")
      .update({ claim_status: "approved", paid: true })
      .eq("id", data.expenseId);

    if (payer?.profile_id) {
      const wallet = await supabase
        .from("wallets")
        .select("*")
        .eq("profile_id", payer.profile_id)
        .maybeSingle();
      if (wallet.data) {
        await supabase
          .from("wallets")
          .update({ available: round2(Number(wallet.data.available ?? 0) + amount) })
          .eq("profile_id", payer.profile_id);
      }
      await supabase.from("wallet_transactions").insert({
        profile_id: payer.profile_id,
        name: current.data.title,
        note: "Reimbursed from group wallet",
        amount,
      });
      await supabase.from("notifications").insert({
        profile_id: payer.profile_id,
        title: "Reimbursed",
        body: `$${amount.toFixed(2)} for ${current.data.title} landed in your Divy wallet.`,
        tone: "good",
      });
    }

    await supabase.from("activity_events").insert({
      profile_id: userId,
      group_id: groupId,
      kind: "payment",
      who: "You",
      text: `reimbursed ${payer?.display_name ?? "a member"} for ${current.data.title}`,
      amount: -amount,
    });

    return { ok: true as const, groupId };
  });
