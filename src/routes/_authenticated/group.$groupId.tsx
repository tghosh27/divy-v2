import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowRight,
  Bell,
  Plus,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";

import { AppShell, money } from "@/components/AppShell";
import { BackHeader, meta } from "@/components/SubScreen";
import { GroupWalletDetail } from "@/components/GroupWalletDetail";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { avatarSrc, coverSrc } from "@/lib/divy-assets";
import {
  deleteExpense,
  nudgeGroup,
  remindMember,
  setGroupArchived,
  requestSettleUp,
  setGroupCover,
  startSettleUp,
  transferAdmin,
} from "@/lib/divy.functions";
import { coverOptions } from "@/lib/divy-assets";
import { PhotoPicker } from "@/components/PhotoPicker";
import { Archive, BellRing, Flag, Pencil, ShieldCheck, UserPlus } from "lucide-react";
import { LeaveGroupCard } from "@/components/LeaveGroupCard";
import type { CycleState } from "@/lib/divy-types";
import { advance, fmtDay } from "@/lib/divy-types";
import { SettleProgress } from "@/components/SettleProgress";

export const Route = createFileRoute("/_authenticated/group/$groupId")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () => meta("Group", "Balances, settlement cycle and expenses in this group."),
  component: GroupDetailScreen,
});

const chip: Record<CycleState, string> = {
  overdue: "bg-money-out/12 text-money-out",
  settling: "bg-brand-soft text-brand",
  open: "bg-white/70 text-ink/60",
  settled: "bg-money-in/12 text-money-in",
};

const bar: Record<CycleState, string> = {
  overdue: "bg-money-out",
  settling: "bg-brand",
  open: "bg-brand/50",
  settled: "bg-money-in",
};

type Tab = "balances" | "expenses" | "cycle";

function GroupDetailScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const params = Route.useParams();
  const [tab, setTab] = useState<Tab>("balances");
  const remind = useServerFn(remindMember);
  const beginSettle = useServerFn(startSettleUp);
  const saveCover = useServerFn(setGroupCover);
  const removeExpense = useServerFn(deleteExpense);
  const nudgeAll = useServerFn(nudgeGroup);
  const passAdmin = useServerFn(transferAdmin);
  const refresh = useRefreshSnapshot();
  const [nudged, setNudged] = useState<string | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const archiveGroup = useServerFn(setGroupArchived);
  const [archiveNote, setArchiveNote] = useState<string | null>(null);
  const askSettle = useServerFn(requestSettleUp);
  const [requested, setRequested] = useState(false);

  const detail = data.groupDetails[params.groupId];
  if (!detail) throw notFound();

  if (detail.wallet !== null) {
    return (
      <AppShell>
        <BackHeader
          eyebrow="Shared wallet"
          title={detail.name}
          to="/groups"
          right={<InviteButton groupId={detail.id} />}
        />
        <GroupWalletDetail detail={detail} />
      </AppShell>
    );
  }

  const openDisputes = data.disputes.filter(
    (d) => d.groupId === params.groupId && d.status === "open",
  );
  const windowOpen = detail.cycle === "settling" || detail.cycle === "overdue";
  const owe = detail.members.filter((m) => m.balance < 0);
  const owed = detail.members.filter((m) => m.balance > 0);

  async function handleRemind(memberId: string) {
    await remind({ data: { groupId: params.groupId, memberId } });
    await refresh();
  }

  async function handleNudgeAll() {
    const res = await nudgeAll({ data: { groupId: params.groupId } });
    setNudged(
      res.count
        ? `Nudged ${res.count} ${res.count === 1 ? "person" : "people"}`
        : "Everyone's already been nudged today",
    );
    await refresh();
  }

  async function handlePassAdmin(memberId: string) {
    await passAdmin({ data: { groupId: params.groupId, memberId } });
    setPassOpen(false);
    await refresh();
  }

  async function handleRequestSettle() {
    await askSettle({ data: { groupId: params.groupId } });
    setRequested(true);
    await refresh();
  }

  async function handleStartSettle() {
    await beginSettle({ data: { groupId: params.groupId } });
    await refresh();
  }

  async function handleCover(coverKey: string) {
    await saveCover({ data: { groupId: params.groupId, coverKey } });
    await refresh();
  }

  async function handleDeleteExpense(expenseId: string) {
    await removeExpense({ data: { expenseId } });
    await refresh();
  }

  const card = data.groups.find((g) => g.id === params.groupId);
  const allSquare = detail.members.every((m) => Math.abs(m.balance) < 0.005);

  async function handleArchive(archived: boolean) {
    const res = await archiveGroup({ data: { groupId: params.groupId, archived } });
    if (!res.ok) {
      setArchiveNote(res.error);
      return;
    }
    setArchiveNote(archived ? "Moved to archived groups" : "Back in your groups");
    await refresh();
  }

  return (
    <AppShell>
      <BackHeader
        eyebrow={`${detail.members.length} members`}
        title={detail.name}
        to="/groups"
        right={<InviteButton groupId={detail.id} />}
      />

      {/* hero */}
      <div className="card-in mt-5 overflow-hidden rounded-[28px]">
        <div className="relative h-28">
          <img src={coverSrc(detail.coverKey)} alt={detail.name} className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#241a3d]/80 to-transparent" />
          <div className="absolute inset-x-4 bottom-3 flex items-end justify-between">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${chip[detail.cycle]}`}>
              {detail.cycleLabel}
            </span>
            <div className="flex -space-x-2">
              {detail.members.slice(0, 4).map((m) => (
                <img
                  key={m.id}
                  src={avatarSrc(m.avatarKey)}
                  alt={m.name}
                  className="size-7 rounded-full outline-2 -outline-offset-1 outline-white"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="glass rounded-b-[28px] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
            {detail.balance === 0 ? "You're all even" : detail.balance < 0 ? "You owe" : "You're owed"}
          </p>
          <p
            className={`num mt-1.5 text-[38px] font-bold leading-none tracking-tight ${
              detail.balance === 0 ? "text-ink/70" : detail.balance < 0 ? "text-money-out" : "text-money-in"
            }`}
          >
            ${Math.abs(detail.balance).toFixed(2)}
          </p>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink/8">
            <div
              className={`h-full rounded-full ${bar[detail.cycle]}`}
              style={{ width: `${detail.progress}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-ink/45">
            <span>{detail.cycleStart}</span>
            <span>{detail.cycleEnd}</span>
          </div>

          <div className="mt-4 flex gap-2">
            {windowOpen ? (
              <Link
                to="/settle/$groupId"
                params={{ groupId: detail.id }}
                className={`press flex flex-1 items-center justify-center gap-1.5 rounded-[18px] py-3 text-[12px] font-bold text-white ${
                  detail.cycle === "overdue" ? "bg-money-out" : "bg-brand"
                }`}
              >
                <Wallet className="size-4" />
                {detail.balance < 0 ? "Pay" : detail.balance > 0 ? "Request payout" : "Settle up"}
              </Link>
            ) : detail.youAdmin && detail.settleMode !== "scheduled" ? (
              <button
                onClick={handleStartSettle}
                className="press flex flex-1 items-center justify-center gap-1.5 rounded-[18px] bg-brand py-3 text-[12px] font-bold text-white"
              >
                <Wallet className="size-4" />
                Start settle-up
              </button>
            ) : detail.settleMode === "scheduled" && detail.settleAnchor ? (
              <div className="flex flex-1 items-center justify-center gap-1.5 rounded-[18px] bg-white/55 py-3 text-[12px] font-semibold text-ink/45 outline-1 -outline-offset-1 outline-black/5">
                <ShieldCheck className="size-4" />
                {`Opens ${fmtDay(detail.settleAnchor)}`}
              </div>
            ) : (
              <button
                onClick={handleRequestSettle}
                disabled={requested}
                className="press flex flex-1 items-center justify-center gap-1.5 rounded-[18px] bg-white/55 py-3 text-[12px] font-bold text-brand outline-1 -outline-offset-1 outline-brand/25 disabled:text-ink/45"
              >
                <ShieldCheck className="size-4" />
                {requested ? "Admin asked" : "Request settle-up"}
              </button>
            )}
            <Link
              to="/add-expense"
              className="press glass flex flex-1 items-center justify-center gap-1.5 rounded-[18px] py-3 text-[12px] font-bold text-ink"
            >
              <Plus className="size-4 text-brand" />
              Add expense
            </Link>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="glass card-in mt-5 flex gap-1 rounded-full p-1" style={{ animationDelay: "0.06s" }}>
        {(
          [
            { id: "balances", label: "Balances", icon: Users },
            { id: "expenses", label: "Expenses", icon: Receipt },
            { id: "cycle", label: "Cycle", icon: Bell },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`press flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[11px] font-bold transition-colors ${
              tab === t.id ? "bg-brand text-white" : "text-ink/55"
            }`}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <SettleProgress detail={detail} />

      {tab === "balances" ? (
        <div className="mt-4 space-y-3">
          <div className="glass card-in rounded-[24px] px-4">
            <p className="py-3.5 text-sm font-semibold">Who owes what</p>
            <div className="divide-y divide-black/5 border-t border-black/5">
              {detail.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-3.5">
                  <img src={avatarSrc(m.avatarKey)} alt={m.name} className="size-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.name}</p>
                    <p className="text-[11px] text-ink/50">
                      {m.balance === 0 ? "All even" : m.balance < 0 ? "Owes the group" : "Is owed"}
                    </p>
                  </div>
                  <p
                    className={`num text-sm font-bold ${
                      m.balance === 0
                        ? "text-ink/50"
                        : m.balance < 0
                          ? "text-money-out"
                          : "text-money-in"
                    }`}
                  >
                    {m.balance === 0 ? "$0.00" : money(m.balance)}
                  </p>
                  {!m.isYou && m.balance < 0 ? (
                    <button
                      onClick={() => handleRemind(m.id)}
                      className="press shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-bold text-brand"
                    >
                      Remind
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {owe.filter((m) => !m.isYou).length ? (
              <div className="border-t border-black/5 py-3">
                <button
                  onClick={handleNudgeAll}
                  className="press flex w-full items-center justify-center gap-1.5 rounded-[16px] bg-brand-soft py-2.5 text-[12px] font-bold text-brand"
                >
                  <BellRing className="size-3.5" /> Nudge everyone who owes
                </button>
                {nudged ? (
                  <p className="mt-2 text-center text-[11px] font-semibold text-money-in">{nudged}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {openDisputes.length ? (
            <div className="card-in rounded-[24px] bg-white p-4 outline-1 -outline-offset-1 outline-money-out/25">
              <p className="flex items-center gap-1.5 text-sm font-bold text-money-out">
                <Flag className="size-4" /> Flagged charges
              </p>
              <div className="mt-2 space-y-2">
                {openDisputes.map((d) => (
                  <Link
                    key={d.id}
                    to="/expense/$expenseId"
                    params={{ expenseId: d.expenseId ?? "" }}
                    className="press block rounded-2xl bg-white/70 p-3 outline-1 -outline-offset-1 outline-black/5"
                  >
                    <p className="text-[12px] font-semibold">{d.expenseTitle}</p>
                    <p className="mt-0.5 text-[11px] text-ink/55">
                      {d.by} · “{d.reason}”
                    </p>
                  </Link>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink/45">
                {detail.youAdmin ? "Tap one to remove or keep the charge." : "An admin is reviewing these."}
              </p>
            </div>
          ) : null}

        </div>
      ) : null}

      {tab === "expenses" ? (
        <div className="glass card-in mt-4 rounded-[24px] px-4">
          {detail.expenses.length ? (
            <>
              <div className="flex items-center justify-between py-3.5">
                <p className="text-sm font-semibold">This cycle</p>
                <p className="num text-[11px] font-bold text-ink/50">
                  ${detail.totalSpent.toFixed(2)} total
                </p>
              </div>
              <div className="divide-y divide-black/5 border-t border-black/5">
                {detail.expenses.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 py-3.5">
                    <Link
                      to="/expense/$expenseId"
                      params={{ expenseId: e.id }}
                      className="press flex min-w-0 flex-1 items-center gap-3"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-[10px] font-bold text-brand">
                        {e.category.slice(0, 2)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{e.title}</p>
                        <p className="truncate text-[11px] text-ink/50">
                          {e.payer} paid · {e.date}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="num text-sm font-bold">${e.total.toFixed(2)}</p>
                        <p className="num text-[11px] text-ink/45">${e.each.toFixed(2)}/ea</p>
                      </div>
                    </Link>
                    <button
                      onClick={() => handleDeleteExpense(e.id)}
                      className="press shrink-0 text-[10px] font-bold text-money-out"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold">No expenses yet</p>
              <p className="mt-1 text-[12px] text-ink/50">Add the first one and we'll split it.</p>
            </div>
          )}
        </div>
      ) : null}

      {tab === "cycle" ? (
        <div className="glass card-in mt-4 rounded-[24px] p-4">
          <p className="text-sm font-semibold">Cycle {detail.cycleStart} – {detail.cycleEnd}</p>
          <div className="mt-3 divide-y divide-black/5">
            <SummaryRow label="Group spend" value={`$${detail.totalSpent.toFixed(2)}`} />
            <SummaryRow label="You paid" value={`$${detail.youPaid.toFixed(2)}`} />
            <SummaryRow label="Your share" value={`$${detail.yourShare.toFixed(2)}`} />
            <SummaryRow
              label="Net"
              value={detail.balance === 0 ? "$0.00" : money(detail.balance)}
              tone={detail.balance < 0 ? "out" : detail.balance > 0 ? "in" : undefined}
            />
          </div>
          <div className="mt-4 space-y-2">
            {detail.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5">
                <img src={avatarSrc(m.avatarKey)} alt="" className="size-6 rounded-full" />
                <span className="flex-1 text-[12px] font-semibold">{m.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    m.paid ? "bg-money-in/12 text-money-in" : "bg-money-out/12 text-money-out"
                  }`}
                >
                  {m.paid ? "Settled" : "Pending"}
                </span>
              </div>
            ))}
          </div>

          {detail.youAdmin ? (
            <div className="mt-4 rounded-2xl bg-brand-soft/60 p-3.5 outline-1 -outline-offset-1 outline-brand/15">
              <p className="flex items-center gap-1.5 text-[12px] font-bold text-brand">
                <ShieldCheck className="size-3.5" /> Admin controls
              </p>
              <p className="mt-0.5 text-[11px] text-ink/55">
                {detail.settleMode === "scheduled"
                  ? "This group runs on a schedule — you only edit details."
                  : "Only you can start a settle-up or edit the group."}
              </p>
              {detail.settleMode === "scheduled" ? (
                <p className="mt-3 rounded-[16px] bg-white px-3 py-2.5 text-[11px] font-semibold text-ink/60 outline-1 -outline-offset-1 outline-black/8">
                  {!detail.settleAnchor
                    ? "The window opens by itself on schedule."
                    : detail.cycle === "settling" || detail.cycle === "overdue"
                      ? `The window is open now. Next one starts ${fmtDay(
                          detail.settleFrequency
                            ? advance(detail.settleAnchor, detail.settleFrequency, 1)
                            : detail.settleAnchor,
                        )} on its own.`
                      : `Window opens by itself on ${fmtDay(detail.settleAnchor)}, then repeats.`}
                </p>
              ) : (
                <button
                  onClick={handleStartSettle}
                  className="press mt-3 w-full rounded-[16px] bg-brand py-2.5 text-[12px] font-bold text-white"
                >
                  Start settle-up
                </button>
              )}
              <Link
                to="/edit-group/$groupId"
                params={{ groupId: params.groupId }}
                className="press mt-3 flex w-full items-center justify-center gap-1.5 rounded-[16px] bg-white py-2.5 text-[12px] font-bold text-brand outline-1 -outline-offset-1 outline-brand/25"
              >
                <Pencil className="size-3.5" /> Edit group details
              </Link>
              <button
                onClick={() => setPassOpen((v) => !v)}
                className="press mt-2 w-full rounded-[16px] bg-white py-2.5 text-[12px] font-bold text-brand outline-1 -outline-offset-1 outline-brand/25"
              >
                Make someone else admin
              </button>
              {passOpen ? (
                <div className="mt-2 space-y-1.5">
                  {detail.members
                    .filter((m) => !m.isYou)
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handlePassAdmin(m.id)}
                        className="press flex w-full items-center gap-2.5 rounded-2xl bg-white px-3 py-2.5 text-left outline-1 -outline-offset-1 outline-black/8"
                      >
                        <img src={avatarSrc(m.avatarKey)} alt="" className="size-7 rounded-full" />
                        <span className="flex-1 text-[12px] font-semibold">{m.name}</span>
                        <span className="text-[10px] font-bold text-brand">
                          {m.admin ? "Admin" : "Make admin"}
                        </span>
                      </button>
                    ))}
                  {detail.members.filter((m) => !m.isYou).length === 0 ? (
                    <p className="text-[11px] text-ink/50">Invite someone first.</p>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-3">
                <PhotoPicker
                  label="Group photo"
                  value={detail.coverKey}
                  onChange={handleCover}
                  options={coverOptions}
                  srcFor={coverSrc}
                  hint="Take one, pick from your photos, or use a default."
                />
              </div>
            </div>
          ) : null}

          <div className="glass card-in mt-4 rounded-[24px] p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-bold">
              <Archive className="size-3.5 text-ink/55" />
              {card?.archived ? "Archived group" : "Done with this group?"}
            </p>
            <p className="mt-0.5 text-[11px] text-ink/55">
              {card?.archived
                ? "It's tucked away and out of your main list. Nothing was deleted."
                : allSquare
                  ? "Archiving keeps the history but takes it out of your groups list."
                  : "You can archive it once everyone in the group is settled up."}
            </p>
            {card?.archived ? (
              <button
                onClick={() => handleArchive(false)}
                className="press mt-3 w-full rounded-[16px] bg-white py-2.5 text-[12px] font-bold text-brand outline-1 -outline-offset-1 outline-brand/25"
              >
                Restore group
              </button>
            ) : (
              <button
                onClick={() => handleArchive(true)}
                disabled={!allSquare}
                className="press mt-3 w-full rounded-[16px] bg-white py-2.5 text-[12px] font-bold text-ink outline-1 -outline-offset-1 outline-black/8 disabled:opacity-45"
              >
                Archive group
              </button>
            )}
            {archiveNote ? (
              <p className="mt-2 text-center text-[11px] font-semibold text-brand">{archiveNote}</p>
            ) : null}
          </div>

          <LeaveGroupCard detail={detail} />
        </div>
      ) : null}
    </AppShell>
  );
}

function InviteButton({ groupId }: { groupId: string }) {
  return (
    <Link
      to="/invite/$groupId"
      params={{ groupId }}
      aria-label="Invite people"
      className="press grid size-10 place-items-center rounded-full bg-white/55 text-brand outline-1 -outline-offset-1 outline-black/5"
    >
      <UserPlus className="size-4" />
    </Link>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "in" | "out" | undefined;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[13px] text-ink/55">{label}</span>
      <span
        className={`num text-[13px] font-bold ${
          tone === "out" ? "text-money-out" : tone === "in" ? "text-money-in" : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
