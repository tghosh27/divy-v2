import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { useRefreshSnapshot } from "@/lib/divy-client";
import { leaveGroup } from "@/lib/divy.functions";
import type { GroupDetail } from "@/lib/divy-types";

/** Lets a member remove themselves — only when nothing is owed either way. */
export function LeaveGroupCard({ detail }: { detail: GroupDetail }) {
  const leave = useServerFn(leaveGroup);
  const refresh = useRefreshSnapshot();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const you = detail.members.find((m) => m.isYou);
  const square = !you || (Math.abs(you.balance) < 0.005 && you.paid);
  const pendingClaim = detail.expenses.some(
    (e) => e.payerMemberId === detail.yourMemberId && e.claimStatus === "pending",
  );
  const canLeave = square && !pendingClaim;

  async function handleLeave() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await leave({ data: { groupId: detail.id } });
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      setConfirming(false);
      return;
    }
    await refresh();
    navigate({ to: "/groups" });
  }

  return (
    <div className="glass card-in mt-4 rounded-[24px] p-4">
      <p className="flex items-center gap-1.5 text-[12px] font-bold">
        <LogOut className="size-3.5 text-ink/55" /> Leave this group
      </p>
      <p className="mt-0.5 text-[11px] text-ink/55">
        {canLeave
          ? "You're all square, so you can step out. Past expenses stay in the group's history."
          : pendingClaim
            ? "You have a reimbursement still waiting on an admin."
            : "You can leave once your balance is $0.00 and nothing is due."}
      </p>
      {confirming ? (
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleLeave}
            disabled={busy}
            className="press flex-1 rounded-[16px] bg-money-out py-2.5 text-[12px] font-bold text-white disabled:opacity-50"
          >
            Yes, leave
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="press flex-1 rounded-[16px] bg-white py-2.5 text-[12px] font-bold text-ink outline-1 -outline-offset-1 outline-black/8"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          disabled={!canLeave}
          className="press mt-3 w-full rounded-[16px] bg-white py-2.5 text-[12px] font-bold text-money-out outline-1 -outline-offset-1 outline-money-out/25 disabled:opacity-45"
        >
          Leave group
        </button>
      )}
      {error ? <p className="mt-2 text-center text-[11px] font-semibold text-money-out">{error}</p> : null}
    </div>
  );
}
