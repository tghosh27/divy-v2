import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarDays, Pencil, Trash2, Users, Wallet } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { BackHeader, meta } from "@/components/SubScreen";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { deleteFundingRequest, updateFundingRequest } from "@/lib/divy.functions";
import { avatarSrc } from "@/lib/divy-assets";

export const Route = createFileRoute("/_authenticated/funding/$groupId/$requestId")({
  loader: async ({ context, params }) => {
    const snapshot = await context.queryClient.ensureQueryData(snapshotQuery);
    const detail = snapshot.groupDetails[params.groupId];
    if (!detail?.wallet) throw notFound();
    return snapshot;
  },
  head: () => meta("Funding request", "See who has chipped in and who still owes."),
  component: FundingDetail,
});

function FundingDetail() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(snapshotQuery);
  const navigate = useNavigate();
  const refresh = useRefreshSnapshot();
  const removeFunding = useServerFn(deleteFundingRequest);
  const saveFunding = useServerFn(updateFundingRequest);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", amount: "", dueOn: "" });

  const detailMaybe = data.groupDetails[params.groupId];
  const requestMaybe = detailMaybe?.wallet?.fundingRequests.find((r) => r.id === params.requestId);
  if (!detailMaybe || !requestMaybe) return null;
  const detail = detailMaybe;
  const request = requestMaybe;

  const pct = request.goal > 0 ? Math.min(100, Math.round((request.collected / request.goal) * 100)) : 0;
  const paidUp = request.contributors.filter((c) => c.settled);
  const owing = request.contributors.filter((c) => !c.settled);
  const you = request.contributors.find((c) => c.isYou);

  function startEdit() {
    setEditError(null);
    setForm({
      title: request.title,
      amount: request.amount.toFixed(2),
      dueOn: request.dueIso ?? "",
    });
    setEditing(true);
  }

  async function handleSave() {
    if (busy) return;
    setBusy(true);
    setEditError(null);
    const res = await saveFunding({
      data: {
        groupId: detail.id,
        requestId: request.id,
        title: form.title,
        amount: Number(form.amount) || 0,
        dueOn: form.dueOn || null,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setEditError(res.error ?? "Couldn't save that.");
      return;
    }
    setEditing(false);
    await refresh();
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    await removeFunding({ data: { groupId: detail.id, requestId: request.id } });
    await refresh();
    navigate({ to: "/group/$groupId", params: { groupId: detail.id } });
  }

  return (
    <AppShell>
      <BackHeader eyebrow="Funding" title={request.title} to={`/group/${detail.id}`} />

      <div className="glass card-in mt-1 rounded-[28px] p-5 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
          {detail.name}
        </p>
        <p className="mt-1.5 text-lg font-semibold">{request.title}</p>
        <p className="num mt-2 text-[40px] font-bold leading-none">
          ${request.collected.toFixed(2)}
        </p>
        <p className="mt-1 text-[11px] text-ink/50">
          collected of ${request.goal.toFixed(2)} goal
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/8">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex justify-center gap-2 text-[11px] font-semibold text-ink/55">
          <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 outline-1 -outline-offset-1 outline-black/8">
            <CalendarDays className="size-3 text-brand" /> Due {request.due}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 outline-1 -outline-offset-1 outline-black/8">
            <Users className="size-3 text-brand" /> {request.audience}
          </span>
        </div>
      </div>

      <div className="glass card-in mt-3 rounded-[24px] p-4" style={{ animationDelay: "0.04s" }}>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">Each person owes</p>
          <p className="num text-sm font-bold text-brand">${request.amount.toFixed(2)}</p>
        </div>
        <p className="mt-1 text-[11px] text-ink/50">
          {paidUp.length} of {request.contributors.length} have chipped in
        </p>
        {you && !you.settled ? (
          <Link
            to="/contribute/$groupId"
            params={{ groupId: detail.id }}
            search={{ requestId: request.id }}
            className="press mt-3 flex items-center justify-center gap-1.5 rounded-[18px] bg-brand py-3 text-[12px] font-bold text-white"
          >
            <Wallet className="size-4" /> Pay ${(you.expected - you.paid).toFixed(2)}
          </Link>
        ) : null}
      </div>

      <Section title="Still to pay" rows={owing} empty="Everyone has paid." />
      <Section title="Paid" rows={paidUp} empty="No payments yet." />

      {detail.youAdmin ? (
        <div className="glass card-in mt-3 rounded-[24px] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Admin controls</p>
            <button
              onClick={() => (editing ? setEditing(false) : startEdit())}
              className="press flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-[11px] font-bold text-brand"
            >
              <Pencil className="size-3.5" /> {editing ? "Cancel" : "Edit request"}
            </button>
          </div>
          {editing ? (
            <div className="mt-3 space-y-2.5">
              <Field label="What it's for">
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                />
              </Field>
              <Field label="Each person pays">
                <input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="num w-full bg-transparent text-sm font-semibold outline-none"
                />
              </Field>
              <Field label="Due date">
                <input
                  type="date"
                  value={form.dueOn}
                  onChange={(e) => setForm((f) => ({ ...f, dueOn: e.target.value }))}
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                />
              </Field>
              <p className="text-[11px] text-ink/50">
                The group goal updates to this amount for every member.
              </p>
              <button
                onClick={handleSave}
                disabled={busy}
                className="press w-full rounded-[18px] bg-brand py-3 text-[12px] font-bold text-white disabled:opacity-50"
              >
                Save changes
              </button>
              {editError ? (
                <p className="text-center text-[11px] font-semibold text-money-out">{editError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {detail.youAdmin ? (
        <button
          onClick={handleDelete}
          className="press glass mt-3 flex w-full items-center justify-center gap-1.5 rounded-[18px] py-3 text-[12px] font-bold text-money-out"
        >
          <Trash2 className="size-4" /> Delete request
        </button>
      ) : null}
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-2xl bg-white px-3.5 py-2.5 outline-1 -outline-offset-1 outline-black/8">
      <span className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Section({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: {
    memberId: string;
    name: string;
    avatarKey: string;
    expected: number;
    paid: number;
    settled: boolean;
  }[];
  empty: string;
}) {
  return (
    <div className="glass card-in mt-3 rounded-[24px] p-4">
      <p className="text-sm font-semibold">{title}</p>
      {rows.length ? (
        <div className="mt-1 divide-y divide-black/5">
          {rows.map((c) => (
            <div key={c.memberId} className="flex items-center gap-3 py-3">
              <img src={avatarSrc(c.avatarKey)} alt={c.name} className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="text-[11px] text-ink/50">
                  {c.settled
                    ? `Paid $${c.paid.toFixed(2)}`
                    : c.paid > 0
                      ? `Paid $${c.paid.toFixed(2)} of $${c.expected.toFixed(2)}`
                      : `Owes $${c.expected.toFixed(2)}`}
                </p>
              </div>
              <p className={`num text-sm font-bold ${c.settled ? "text-money-in" : "text-money-out"}`}>
                {c.settled ? `+$${c.paid.toFixed(2)}` : `$${(c.expected - c.paid).toFixed(2)}`}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-ink/45">{empty}</p>
      )}
    </div>
  );
}
