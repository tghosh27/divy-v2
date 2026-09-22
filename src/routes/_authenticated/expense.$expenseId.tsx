import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Camera, Flag, Images, Pencil, Repeat, Share2, ShieldCheck, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { BackHeader, meta } from "@/components/SubScreen";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { avatarSrc } from "@/lib/divy-assets";
import { RECUR_LABEL } from "@/lib/divy-types";
import { fileToPhotoKey } from "@/lib/photo-input";
import {
  deleteExpense,
  raiseDispute,
  resolveDispute,
  setExpenseReceipt,
  updateExpense,
} from "@/lib/divy.functions";

export const Route = createFileRoute("/_authenticated/expense/$expenseId")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () => meta("Expense", "Expense details and who covered it."),
  component: ExpenseScreen,
});

const CATEGORIES: { id: string; label: string }[] = [
  { id: "food", label: "Food" },
  { id: "lodging", label: "Stay" },
  { id: "transport", label: "Rides" },
  { id: "groceries", label: "Grocery" },
  { id: "fun", label: "Fun" },
  { id: "utilities", label: "Bills" },
  { id: "travel", label: "Travel" },
  { id: "drinks", label: "Drinks" },
  { id: "other", label: "Other" },
];

function ExpenseScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const params = Route.useParams();
  const navigate = useNavigate();
  const removeExpense = useServerFn(deleteExpense);
  const saveReceipt = useServerFn(setExpenseReceipt);
  const flagCharge = useServerFn(raiseDispute);
  const settleDispute = useServerFn(resolveDispute);
  const saveExpense = useServerFn(updateExpense);
  const refresh = useRefreshSnapshot();

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<{
    title: string;
    total: string;
    category: string;
    payerMemberId: string;
    spentOn: string;
  } | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let found: { groupId: string; groupName: string; isWallet: boolean } | null = null;
  let expense = null;
  let members = null;
  let youAdmin = false;
  for (const [groupId, detail] of Object.entries(data.groupDetails)) {
    const match = detail.expenses.find((e) => e.id === params.expenseId);
    if (match) {
      found = { groupId, groupName: detail.name, isWallet: detail.kind === "wallet" };
      expense = match;
      members = detail.members;
      youAdmin = detail.youAdmin;
      break;
    }
  }

  if (!found || !expense || !members) throw notFound();
  const groupId = found.groupId;
  const groupName = found.groupName;
  const isWallet = found.isWallet;
  const dispute = data.disputes.find((d) => d.expenseId === expense!.id) ?? null;
  const openDispute = dispute && dispute.status === "open" ? dispute : null;

  function startEdit() {
    setDraft({
      title: expense!.title,
      total: expense!.total.toFixed(2),
      category: expense!.category,
      payerMemberId: expense!.payerMemberId ?? members![0]!.id,
      spentOn: expense!.isoDate,
    });
    setEditOpen(true);
    setError(null);
  }

  async function saveEdit() {
    if (!draft || busy) return;
    const total = Number(draft.total);
    if (!draft.title.trim()) return setError("Give it a name");
    if (!Number.isFinite(total) || total <= 0) return setError("Enter an amount");
    setBusy(true);
    const res = await saveExpense({
      data: {
        expenseId: expense!.id,
        title: draft.title,
        total,
        category: draft.category,
        payerMemberId: draft.payerMemberId,
        spentOn: draft.spentOn,
      },
    });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Could not save those changes");
    setEditOpen(false);
    await refresh();
  }

  async function handleDelete() {
    await removeExpense({ data: { expenseId: expense!.id } });
    await refresh();
    navigate({ to: "/group/$groupId", params: { groupId } });
  }

  async function pickReceipt(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const key = await fileToPhotoKey(file, 900);
      await saveReceipt({ data: { expenseId: expense!.id, receiptKey: key } });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not use that photo");
    } finally {
      setBusy(false);
    }
  }

  async function submitFlag() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await flagCharge({
      data: { groupId, expenseId: expense!.id, reason },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not flag this charge");
      return;
    }
    setFlagOpen(false);
    setReason("");
    await refresh();
  }

  async function decide(action: "remove" | "keep") {
    if (!openDispute || busy) return;
    setBusy(true);
    const res = await settleDispute({ data: { disputeId: openDispute.id, action } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not update this");
      return;
    }
    await refresh();
    if (action === "remove") navigate({ to: "/group/$groupId", params: { groupId } });
  }

  return (
    <AppShell>
      <BackHeader
        eyebrow={groupName}
        title={expense.title}
        right={
          <button
            aria-label="Share expense"
            className="press grid size-10 place-items-center rounded-full bg-white/55 text-ink/60 outline-1 -outline-offset-1 outline-black/5"
          >
            <Share2 className="size-4" />
          </button>
        }
      />

      <div className="glass card-in mt-5 rounded-[28px] p-5 text-center">
        <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-bold text-brand">
          {expense.category}
        </span>
        <p className="num mt-3 text-[42px] font-bold leading-none tracking-tight">
          ${expense.total.toFixed(2)}
        </p>
        <p className="mt-2 text-[12px] text-ink/55">
          {expense.payer} paid · {expense.date}
        </p>
        {expense.addedByName && expense.addedByName !== expense.payer ? (
          <p className="mt-1 text-[11px] font-semibold text-ink/45">
            Added by {expense.addedByName}
          </p>
        ) : null}
        {expense.recur ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-bold text-brand">
            <Repeat className="size-3" />
            {RECUR_LABEL[expense.recur]}
          </p>
        ) : null}
      </div>

      {editOpen && draft ? (
        <div className="glass card-in mt-4 rounded-[24px] p-4">
          <p className="text-sm font-semibold">Edit expense</p>
          <label className="mt-3 block text-[11px] font-semibold text-ink/50">What was it?</label>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold outline-1 -outline-offset-1 outline-black/8 focus:outline-brand"
          />
          <div className="mt-3 flex gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-ink/50">Amount</label>
              <input
                value={draft.total}
                onChange={(e) => setDraft({ ...draft, total: e.target.value.replace(/[^0-9.]/g, "") })}
                inputMode="decimal"
                className="num mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-bold outline-1 -outline-offset-1 outline-black/8 focus:outline-brand"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-ink/50">Date</label>
              <input
                type="date"
                value={draft.spentOn}
                onChange={(e) => setDraft({ ...draft, spentOn: e.target.value })}
                className="num mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold outline-1 -outline-offset-1 outline-black/8 focus:outline-brand"
              />
            </div>
          </div>

          <label className="mt-3 block text-[11px] font-semibold text-ink/50">Category</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setDraft({ ...draft, category: c.id })}
                className={`press rounded-full px-3 py-2 text-[11px] font-bold ${
                  draft.category === c.id
                    ? "bg-brand text-white"
                    : "bg-white/70 text-ink/60 outline-1 -outline-offset-1 outline-black/8"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <label className="mt-3 block text-[11px] font-semibold text-ink/50">Who paid</label>
          <div className="mt-1 space-y-1.5">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setDraft({ ...draft, payerMemberId: m.id })}
                className={`press flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left ${
                  draft.payerMemberId === m.id
                    ? "bg-brand-soft outline-1 -outline-offset-1 outline-brand/25"
                    : "bg-white/70 outline-1 -outline-offset-1 outline-black/8"
                }`}
              >
                <img src={avatarSrc(m.avatarKey)} alt="" className="size-7 rounded-full" />
                <span className="flex-1 text-[12px] font-semibold">{m.name}</span>
                {draft.payerMemberId === m.id ? (
                  <span className="text-[10px] font-bold text-brand">Paid</span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={saveEdit}
              disabled={busy}
              className="press flex-1 rounded-[16px] bg-brand py-3 text-[12px] font-bold text-white"
            >
              Save changes
            </button>
            <button
              onClick={() => setEditOpen(false)}
              className="press flex-1 rounded-[16px] bg-white py-3 text-[12px] font-bold text-ink/60 outline-1 -outline-offset-1 outline-black/10"
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-[11px] text-ink/45">
            {isWallet
              ? "The reimbursement amount updates to match."
              : "Everyone's balance updates to match the new split."}
          </p>
        </div>
      ) : null}

      {/* dispute banner */}
      {openDispute ? (
        <div
          className="card-in mt-4 rounded-[24px] bg-white p-4 outline-1 -outline-offset-1 outline-money-out/25"
          style={{ animationDelay: "0.04s" }}
        >
          <p className="flex items-center gap-1.5 text-sm font-bold text-money-out">
            <Flag className="size-4" /> Flagged for review
          </p>
          <p className="mt-1 text-[12px] text-ink/60">
            {openDispute.by} said: “{openDispute.reason}”
          </p>
          {youAdmin ? (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => decide("remove")}
                disabled={busy}
                className="press flex-1 rounded-[16px] bg-money-out py-2.5 text-[12px] font-bold text-white"
              >
                Remove charge
              </button>
              <button
                onClick={() => decide("keep")}
                disabled={busy}
                className="press flex-1 rounded-[16px] bg-white py-2.5 text-[12px] font-bold text-ink/70 outline-1 -outline-offset-1 outline-black/10"
              >
                Keep it
              </button>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-ink/45">An admin will review this.</p>
          )}
        </div>
      ) : dispute ? (
        <div className="glass card-in mt-4 rounded-[24px] p-4">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink/70">
            <ShieldCheck className="size-4 text-brand" />
            {dispute.status === "resolved" ? "Flag accepted" : "Reviewed and kept"}
          </p>
          <p className="mt-1 text-[12px] text-ink/55">{dispute.resolution}</p>
        </div>
      ) : null}

      {/* receipt */}
      <div className="glass card-in mt-4 rounded-[24px] p-4" style={{ animationDelay: "0.05s" }}>
        <p className="text-[11px] font-semibold text-ink/50">Receipt</p>
        {expense.receiptKey ? (
          <img
            src={expense.receiptKey}
            alt="Receipt"
            className="mt-2 w-full rounded-[18px] object-cover outline-1 -outline-offset-1 outline-black/8"
          />
        ) : (
          <p className="mt-1 text-[12px] text-ink/45">No receipt on this expense yet.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <label className="press flex cursor-pointer items-center gap-1.5 rounded-full bg-white/70 px-3 py-2 text-[11px] font-semibold text-ink/70 outline-1 -outline-offset-1 outline-black/8">
            <Images className="size-3.5 text-brand" /> My photos
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void pickReceipt(file);
              }}
            />
          </label>
          <label className="press flex cursor-pointer items-center gap-1.5 rounded-full bg-white/70 px-3 py-2 text-[11px] font-semibold text-ink/70 outline-1 -outline-offset-1 outline-black/8">
            <Camera className="size-3.5 text-brand" /> Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void pickReceipt(file);
              }}
            />
          </label>
          {expense.receiptKey ? (
            <button
              onClick={async () => {
                await saveReceipt({ data: { expenseId: expense!.id, receiptKey: null } });
                await refresh();
              }}
              className="press flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-2 text-[11px] font-semibold text-money-out outline-1 -outline-offset-1 outline-black/8"
            >
              <Trash2 className="size-3.5" /> Remove
            </button>
          ) : null}
        </div>
      </div>

      {isWallet ? (
        <div className="glass card-in mt-4 rounded-[24px] p-4" style={{ animationDelay: "0.06s" }}>
          <p className="text-sm font-semibold">Reimbursement</p>
          <p className="mt-0.5 text-[11px] text-ink/50">
            Nothing is split here — {expense.payer} paid for the group and gets the full amount back
            from the shared wallet.
          </p>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-white p-3 outline-1 -outline-offset-1 outline-black/8">
            <span className="text-[12px] font-semibold text-ink/70">
              {expense.payer} gets back
            </span>
            <span className="num text-sm font-bold text-money-in">
              +${expense.total.toFixed(2)}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-ink/50">
            {expense.claimStatus === "approved"
              ? "Paid out of the wallet"
              : expense.claimStatus === "declined"
                ? "An admin declined this one"
                : "Waiting on an admin to approve it"}
          </p>
        </div>
      ) : (
      <div className="glass card-in mt-4 rounded-[24px] px-4" style={{ animationDelay: "0.06s" }}>
        <div className="flex items-center justify-between py-3.5">
          <p className="text-sm font-semibold">Split equally</p>
          <p className="num text-[11px] font-bold text-brand">
            ${expense.each.toFixed(2)} × {members.length}
          </p>
        </div>
        <div className="divide-y divide-black/5 border-t border-black/5">
          {members.map((m) => {
            const isPayer = expense!.payer === m.name;
            return (
              <div key={m.id} className="flex items-center gap-3 py-3.5">
                <img src={avatarSrc(m.avatarKey)} alt={m.name} className="size-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.name}</p>
                  <p className="text-[11px] text-ink/50">{isPayer ? "Paid the bill" : "Owes their share"}</p>
                </div>
                <p
                  className={`num text-sm font-bold ${isPayer ? "text-money-in" : "text-money-out"}`}
                >
                  {isPayer
                    ? `+$${(expense!.total - expense!.each).toFixed(2)}`
                    : `-$${expense!.each.toFixed(2)}`}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {error ? (
        <p className="mt-3 text-center text-[12px] font-semibold text-money-out">{error}</p>
      ) : null}

      {/* flag */}
      {flagOpen ? (
        <div className="glass card-in mt-4 rounded-[24px] p-4">
          <p className="text-sm font-semibold">What looks wrong?</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="I wasn't there for this one"
            className="mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-1 -outline-offset-1 outline-black/8 focus:outline-brand"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={submitFlag}
              disabled={busy || !reason.trim()}
              className={`press flex-1 rounded-[16px] py-2.5 text-[12px] font-bold text-white ${
                reason.trim() ? "bg-money-out" : "bg-ink/20"
              }`}
            >
              Send to admin
            </button>
            <button
              onClick={() => setFlagOpen(false)}
              className="press flex-1 rounded-[16px] bg-white py-2.5 text-[12px] font-bold text-ink/60 outline-1 -outline-offset-1 outline-black/10"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        {expense.canEdit ? (
          <button
            onClick={() => (editOpen ? setEditOpen(false) : startEdit())}
            className="press glass flex flex-1 items-center justify-center gap-1.5 rounded-[18px] py-3 text-[12px] font-bold text-ink"
          >
            <Pencil className="size-4 text-brand" /> Edit
          </button>
        ) : null}
        {!dispute || dispute.status !== "open" ? (
          <button
            onClick={() => setFlagOpen((v) => !v)}
            className="press glass flex flex-1 items-center justify-center gap-1.5 rounded-[18px] py-3 text-[12px] font-bold text-ink"
          >
            <Flag className="size-4 text-money-out" /> Dispute
          </button>
        ) : null}
        <button
          onClick={handleDelete}
          className="press glass flex flex-1 items-center justify-center gap-1.5 rounded-[18px] py-3 text-[12px] font-bold text-money-out"
        >
          <Trash2 className="size-4" /> Delete
        </button>
      </div>

      <Link
        to="/group/$groupId"
        params={{ groupId }}
        className="mt-4 block text-center text-xs font-semibold text-brand"
      >
        Back to {groupName}
      </Link>
    </AppShell>
  );
}
