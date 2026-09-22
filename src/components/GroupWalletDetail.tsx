import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BellRing,
  ChevronDown,
  ChevronRight,
  Inbox,
  Pencil,
  Plus,
  Receipt,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { useServerFn } from "@tanstack/react-start";

import { money } from "@/components/AppShell";
import { useRefreshSnapshot } from "@/lib/divy-client";
import { nudgeGroup, resolveReimbursement } from "@/lib/divy.functions";
import { avatarSrc, coverSrc } from "@/lib/divy-assets";
import { LeaveGroupCard } from "@/components/LeaveGroupCard";
import type { GroupDetail } from "@/lib/divy-types";

type Tab = "overview" | "expenses" | "funding";

type LogRow = {
  id: string;
  label: string;
  sub: string;
  isoDate: string;
  delta: number;
  pending: boolean;
  tag: "Dues in" | "Money out";
};

export function GroupWalletDetail({ detail }: { detail: GroupDetail }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [adminOpen, setAdminOpen] = useState(false);
  const [nudged, setNudged] = useState<number | null>(null);
  const [claimFilter, setClaimFilter] = useState<"pending" | "approved" | "all">("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const nudgeAll = useServerFn(nudgeGroup);
  const resolveClaim = useServerFn(resolveReimbursement);
  const refresh = useRefreshSnapshot();
  const isAdmin = detail.youAdmin;

  const wallet = detail.wallet;

  const rows = useMemo<LogRow[]>(() => {
    if (!wallet) return [];
    const deposits: LogRow[] = wallet.deposits.map((d) => ({
      id: `d-${d.id}`,
      label: d.amount < 0 ? "Paid out of the wallet" : `${d.name} paid dues`,
      sub: d.pending ? "Clearing" : d.date,
      isoDate: d.isoDate,
      delta: d.amount,
      pending: d.pending,
      tag: d.amount < 0 ? "Money out" : "Dues in",
    }));
    return deposits.sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  }, [wallet]);

  const months = useMemo(() => {
    const out: { key: string; label: string; rows: LogRow[] }[] = [];
    for (const r of rows) {
      const label = monthLabel(r.isoDate);
      let bucket = out[out.length - 1];
      if (!bucket || bucket.key !== label) {
        bucket = { key: label, label, rows: [] };
        out.push(bucket);
      }
      bucket.rows.push(r);
    }
    return out;
  }, [rows]);

  if (!wallet) return null;

  const claims = detail.expenses.filter((e) =>
    claimFilter === "all"
      ? true
      : claimFilter === "pending"
        ? e.claimStatus !== "approved"
        : e.claimStatus === "approved",
  );
  const pendingCount = detail.expenses.filter((e) => e.claimStatus === "pending").length;

  const paidCount = detail.members.filter((m) => m.paid).length;
  const unpaid = detail.members.filter((m) => !m.paid);
  const pct = detail.members.length ? Math.round((paidCount / detail.members.length) * 100) : 0;

  async function handleNudge() {
    const res = await nudgeAll({ data: { groupId: detail.id } });
    setNudged(res?.count ?? 0);
    await refresh();
  }

  async function handleClaim(expenseId: string, action: "approve" | "decline") {
    if (busy) return;
    setBusy(expenseId);
    setClaimError(null);
    const res = await resolveClaim({ data: { expenseId, action } });
    if (!res.ok) setClaimError(res.error ?? "That didn't go through");
    await refresh();
    setBusy(null);
  }

  return (
    <>
      {/* hero: one headline number */}
      <div className="card-in mt-1 overflow-hidden rounded-[28px]">
        <div className="relative h-28">
          <img
            src={coverSrc(detail.coverKey)}
            alt={detail.name}
            width={992}
            height={672}
            className="size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#241a3d]/85 via-[#241a3d]/30 to-transparent" />
          <span className="absolute right-4 top-3 flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-normal text-white outline-1 -outline-offset-1 outline-white/25">
            <Users className="size-3" /> Shared wallet
          </span>
          <div className="absolute inset-x-4 bottom-3">
            <p className="text-[12px] font-semibold text-white/85">{detail.purpose ?? detail.name}</p>
            <p className="text-[11px] text-white/60">{detail.members.length} members</p>
          </div>
        </div>

        <div className="glass rounded-b-[28px] p-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
            Wallet balance
          </p>
          <p className="num mt-1 text-[40px] font-bold leading-none">
            ${wallet.available.toFixed(2)}
          </p>
          <p className="mt-1.5 text-[11px] text-ink/45">
            {wallet.pending > 0 ? `$${wallet.pending.toFixed(2)} clearing · ` : ""}
            {pendingCount > 0
              ? `${pendingCount} reimbursement${pendingCount === 1 ? "" : "s"} waiting`
              : "No reimbursements waiting"}
          </p>
        </div>
      </div>

      {/* your dues — wallet groups collect dues, they never settle up */}
      <div className="glass card-in mt-3 rounded-[24px] p-4" style={{ animationDelay: "0.04s" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
              Your dues
            </p>
            <p className="num mt-1 text-2xl font-bold leading-none">
              {wallet.yourDues > 0 ? `$${wallet.yourDues.toFixed(2)}` : "All paid up"}
            </p>
            <p className="mt-1 text-[11px] text-ink/50">
              {wallet.yourDues > 0 ? "Owed into the shared wallet" : "Nothing owed right now"}
            </p>
          </div>
          <Link
            to="/contribute/$groupId"
            params={{ groupId: detail.id }}
            search={{}}
            className={`press flex shrink-0 items-center gap-1.5 rounded-[18px] px-4 py-3 text-[12px] font-bold ${
              wallet.yourDues > 0
                ? "bg-brand text-white"
                : "bg-white text-brand outline-1 -outline-offset-1 outline-brand/20"
            }`}
          >
            <Wallet className="size-4" />
            {wallet.yourDues > 0 ? "Pay" : "Add money"}
          </Link>
        </div>

        <Link
          to="/add-expense"
          className="press mt-3 flex items-center justify-center gap-1.5 rounded-[18px] bg-white py-2.5 text-[12px] font-bold text-ink outline-1 -outline-offset-1 outline-black/10"
        >
          <Plus className="size-4 text-brand" /> Add an expense to be reimbursed
        </Link>
      </div>

      {/* dues progress */}
      <div className="glass card-in mt-3 rounded-[24px] p-4" style={{ animationDelay: "0.08s" }}>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">
            {paidCount} of {detail.members.length} paid dues
          </p>
          <span className="num text-[11px] font-bold text-ink/45">{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/8">
          <div className="h-full rounded-full bg-money-in" style={{ width: `${pct}%` }} />
        </div>

        {unpaid.length ? (
          <>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex -space-x-2">
                {unpaid.slice(0, 6).map((m) => (
                  <img
                    key={m.id}
                    src={avatarSrc(m.avatarKey)}
                    alt={m.name}
                    title={m.name}
                    className="size-7 rounded-full outline-2 -outline-offset-1 outline-white"
                  />
                ))}
              </div>
              <p className="min-w-0 flex-1 truncate text-[11px] text-ink/50">
                {unpaid.length === 1
                  ? `${unpaid[0]?.name} still owes`
                  : `${unpaid.length} people still owe`}
              </p>
            </div>
            {isAdmin ? (
              <button
                onClick={handleNudge}
                className="press mt-3 flex w-full items-center justify-center gap-1.5 rounded-[16px] bg-white py-2.5 text-[12px] font-bold text-ink outline-1 -outline-offset-1 outline-black/10"
              >
                <BellRing className="size-4 text-brand" />
                {nudged === null
                  ? "Nudge everyone who owes"
                  : nudged > 0
                    ? `Nudged ${nudged}`
                    : "Everyone's already been nudged today"}
              </button>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-[11px] text-money-in">Everyone's dues are in.</p>
        )}
      </div>

      {/* tabs */}
      <div
        className="glass card-in mt-4 flex gap-1 rounded-full p-1"
        style={{ animationDelay: "0.1s" }}
      >
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "expenses", label: "Expenses" },
            { id: "funding", label: "Funding" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`press flex-1 rounded-full py-2 text-[11px] font-bold transition-colors ${
              tab === t.id ? "bg-brand text-white" : "text-ink/55"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="mt-4 space-y-3">
          <div className="glass card-in rounded-[24px] p-4">
            <p className="text-sm font-semibold">Members</p>
            <div className="mt-2 divide-y divide-black/5">
              {detail.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-3">
                  <img
                    src={avatarSrc(m.avatarKey)}
                    alt={m.name}
                    className="size-9 shrink-0 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{m.name}</span>
                      {m.admin ? (
                        <span className="shrink-0 rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-normal text-brand">
                          Admin
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-ink/50">
                      {m.paid ? "Dues settled" : "Dues pending"}
                    </p>
                  </div>
                  <p className={`num text-sm font-bold ${m.paid ? "text-money-in" : "text-money-out"}`}>
                    {m.paid ? "$0.00" : money(m.balance)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* money log */}
          <div className="glass card-in rounded-[24px] p-4">
            <p className="text-sm font-semibold">Money log</p>
            {months.length ? (
              <div className="mt-2 space-y-3">
                {months.map((mo) => (
                  <div key={mo.key}>
                    <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
                      {mo.label}
                    </p>
                    <div className="mt-1 divide-y divide-black/5">
                      {mo.rows.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 py-3">
                          <span
                            className={`grid size-8 shrink-0 place-items-center rounded-xl ${
                              r.delta >= 0 ? "bg-money-in/12 text-money-in" : "bg-brand-soft text-brand"
                            }`}
                          >
                            {r.delta >= 0 ? (
                              <Wallet className="size-4" />
                            ) : (
                              <ArrowUpRight className="size-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold">{r.label}</p>
                            <p className="truncate text-[11px] text-ink/50">
                              {r.tag} · {r.sub}
                            </p>
                          </div>
                          <p
                            className={`num shrink-0 text-[13px] font-bold ${
                              r.pending ? "text-ink/45" : r.delta >= 0 ? "text-money-in" : "text-money-out"
                            }`}
                          >
                            {r.delta >= 0 ? "+" : "−"}${Math.abs(r.delta).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No money moved yet" note="Dues and payouts will show up here." />
            )}
          </div>

          {isAdmin ? (
            <div className="glass card-in rounded-[24px] px-4">
              <button
                onClick={() => setAdminOpen((v) => !v)}
                aria-expanded={adminOpen}
                className="press flex w-full items-center justify-between py-3.5"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="size-4 text-brand" /> Admin controls
                </span>
                <ChevronDown
                  className={`size-4 text-ink/40 transition-transform ${adminOpen ? "rotate-180" : ""}`}
                />
              </button>
              {adminOpen ? (
                <div className="space-y-2 border-t border-black/5 pb-4 pt-3">
                  <AdminRow
                    to="/wallet-out/$groupId"
                    groupId={detail.id}
                    icon={ArrowUpRight}
                    title="Transfer money out"
                    note="Send to your Divy wallet or a bank"
                  />
                  <AdminRow
                    to="/funding-new/$groupId"
                    groupId={detail.id}
                    icon={Plus}
                    title="Add funding request"
                    note="Ask members to pay toward a goal"
                  />
                  <AdminRow
                    to="/edit-group/$groupId"
                    groupId={detail.id}
                    icon={Pencil}
                    title="Edit group details"
                    note="Name, photo, purpose"
                  />
                  <AdminRow
                    to="/invite/$groupId"
                    groupId={detail.id}
                    icon={UserPlus}
                    title="Invite people"
                    note="Share a link or QR code"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-ink/45">
              <ShieldCheck className="size-3.5" />
              Admins move money out, approve reimbursements and manage funding
            </p>
          )}

          <LeaveGroupCard detail={detail} />
        </div>
      ) : null}

      {tab === "expenses" ? (
        <div className="mt-4 space-y-3">
          <div className="glass card-in rounded-[24px] p-4">
            <p className="text-sm font-semibold">Reimbursements</p>
            <p className="mt-0.5 text-[11px] text-ink/50">
              Someone pays with their own card, an admin pays them back out of the wallet.
            </p>

            <div className="mt-3 flex gap-1 rounded-full bg-white p-1 outline-1 -outline-offset-1 outline-black/8">
              {(
                [
                  { id: "pending", label: "Waiting" },
                  { id: "approved", label: "Reimbursed" },
                  { id: "all", label: "All" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setClaimFilter(f.id)}
                  className={`press flex-1 rounded-full py-1.5 text-[11px] font-bold transition-colors ${
                    claimFilter === f.id ? "bg-brand-soft text-brand" : "text-ink/50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {claimError ? (
              <p className="mt-2 text-[11px] font-semibold text-money-out">{claimError}</p>
            ) : null}

            {claims.length ? (
              <div className="mt-2 divide-y divide-black/5">
                {claims.map((e) => {
                  const status =
                    e.claimStatus === "approved"
                      ? { label: "Reimbursed", tone: "text-money-in" }
                      : e.claimStatus === "declined"
                        ? { label: "Declined", tone: "text-money-out" }
                        : { label: "Waiting on an admin", tone: "text-warn" };
                  return (
                    <div key={e.id} className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                          <Receipt className="size-4" />
                        </span>
                        <Link
                          to="/expense/$expenseId"
                          params={{ expenseId: e.id }}
                          className="min-w-0 flex-1"
                        >
                          <p className="truncate text-[13px] font-semibold">{e.title}</p>
                          <p className="truncate text-[11px] text-ink/50">
                            {e.payer} paid · {e.date}
                          </p>
                        </Link>
                        <div className="shrink-0 text-right">
                          <p className="num text-[13px] font-bold">${e.total.toFixed(2)}</p>
                          <p className={`text-[10px] font-semibold ${status.tone}`}>{status.label}</p>
                        </div>
                      </div>

                      {isAdmin && e.claimStatus === "pending" ? (
                        <div className="mt-2.5 flex gap-2">
                          <button
                            onClick={() => handleClaim(e.id, "approve")}
                            disabled={busy === e.id}
                            className="press flex-1 rounded-[16px] bg-brand py-2.5 text-[12px] font-bold text-white disabled:opacity-60"
                          >
                            {busy === e.id ? "Working…" : `Reimburse $${e.total.toFixed(2)}`}
                          </button>
                          <button
                            onClick={() => handleClaim(e.id, "decline")}
                            disabled={busy === e.id}
                            className="press rounded-[16px] bg-white px-4 py-2.5 text-[12px] font-bold text-ink/60 outline-1 -outline-offset-1 outline-black/10 disabled:opacity-60"
                          >
                            Decline
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Nothing here"
                note="Expenses paid on someone's own card show up here."
              />
            )}
          </div>
        </div>
      ) : null}

      {tab === "funding" ? (
        <div className="mt-4 space-y-3">
          <div className="glass card-in rounded-[24px] p-4">
            <p className="text-sm font-semibold">Funding requests</p>
            <p className="mt-0.5 text-[11px] text-ink/50">Tap one to see who has chipped in</p>

            {wallet.fundingRequests.length ? (
              <div className="mt-3 space-y-2.5">
                {wallet.fundingRequests.map((r) => {
                  const fpct =
                    r.goal > 0 ? Math.min(100, Math.round((r.collected / r.goal) * 100)) : 0;
                  const paidUp = r.contributors.filter((c) => c.settled).length;
                  return (
                    <Link
                      key={r.id}
                      to="/funding/$groupId/$requestId"
                      params={{ groupId: detail.id, requestId: r.id }}
                      className="press block rounded-2xl bg-white p-3 outline-1 -outline-offset-1 outline-black/8"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold">{r.title}</p>
                          <p className="text-[11px] text-ink/50">
                            Due {r.due} · {paidUp} of {r.contributors.length} paid
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <p className="num text-[13px] font-bold text-brand">
                            ${r.amount.toFixed(2)}
                          </p>
                          <ChevronRight className="size-4 text-ink/30" />
                        </div>
                      </div>
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink/8">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${fpct}%` }} />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-ink/50">
                        <span className="num">
                          ${r.collected.toFixed(2)} of ${r.goal.toFixed(2)} collected
                        </span>
                        <span>{fpct}%</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No funding requests" note="An admin can start one to collect." />
            )}

            {isAdmin ? (
              <div className="mt-3">
                <AdminRow
                  to="/funding-new/$groupId"
                  groupId={detail.id}
                  icon={Plus}
                  title="Add funding request"
                  note="Ask members to pay toward a goal"
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function AdminRow({
  to,
  groupId,
  icon: Icon,
  title,
  note,
}: {
  to: "/wallet-out/$groupId" | "/funding-new/$groupId" | "/edit-group/$groupId" | "/invite/$groupId";
  groupId: string;
  icon: typeof Plus;
  title: string;
  note: string;
}) {
  return (
    <Link
      to={to}
      params={{ groupId }}
      className="press flex items-center gap-3 rounded-2xl bg-white p-3 outline-1 -outline-offset-1 outline-black/8"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block text-[11px] text-ink/55">{note}</span>
      </span>
    </Link>
  );
}

function monthLabel(iso: string) {
  if (!iso || iso.length < 7) return "Earlier";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "Earlier";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function EmptyState({ title, note }: { title: string; note: string }) {
  return (
    <div className="py-9 text-center">
      <Inbox className="mx-auto size-6 text-ink/25" />
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-[12px] text-ink/50">{note}</p>
    </div>
  );
}
