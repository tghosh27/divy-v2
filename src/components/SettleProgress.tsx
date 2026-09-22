import { Check } from "lucide-react";

import { avatarSrc } from "@/lib/divy-assets";
import type { GroupDetail } from "@/lib/divy-types";

function isSettled(m: GroupDetail["members"][number]) {
  return m.paid || m.balance > -0.005;
}

/**
 * During a settle-up window: how many people have already paid, with faces —
 * seeing the group move makes it easier to pay too.
 */
export function SettleProgress({ detail }: { detail: GroupDetail }) {
  if (detail.cycle !== "settling" && detail.cycle !== "overdue") return null;
  if (detail.members.length < 2) return null;

  const done = detail.members.filter(isSettled);
  const waiting = detail.members.filter((m) => !isSettled(m));
  const pct = Math.round((done.length / detail.members.length) * 100);
  const youDone = done.some((m) => m.isYou);

  return (
    <div className="glass card-in mt-4 rounded-[24px] p-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-normal text-ink/45 uppercase">
            Settle-up progress
          </p>
          <p className="mt-1 text-[15px] font-semibold">
            {done.length} of {detail.members.length} paid
          </p>
        </div>
        <span className="font-display text-[22px] font-bold text-brand">{pct}%</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/6">
        <div className="h-full rounded-full bg-money-in" style={{ width: `${pct}%` }} />
      </div>

      {done.length ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex -space-x-2">
            {done.slice(0, 6).map((m) => (
              <span key={m.id} className="relative">
                <img
                  src={avatarSrc(m.avatarKey)}
                  alt={m.name}
                  className="size-7 rounded-full outline-2 -outline-offset-1 outline-white"
                />
                <span className="absolute -right-0.5 -bottom-0.5 grid size-3.5 place-items-center rounded-full bg-money-in outline-2 -outline-offset-1 outline-white">
                  <Check className="size-2 text-white" strokeWidth={4} />
                </span>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-ink/55">
            {done
              .slice(0, 3)
              .map((m) => m.name)
              .join(", ")}
            {done.length > 3 ? ` +${done.length - 3} more` : ""} paid
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-ink/55">Nobody has paid yet — be the first.</p>
      )}

      {waiting.length ? (
        <p className="mt-2 text-[11px] text-ink/45">
          Still waiting on{" "}
          <span className="font-semibold text-ink/70">
            {waiting
              .slice(0, 4)
              .map((m) => m.name)
              .join(", ")}
            {waiting.length > 4 ? ` +${waiting.length - 4}` : ""}
          </span>
          {youDone ? "" : " · including you"}
        </p>
      ) : (
        <p className="mt-2 text-[11px] font-semibold text-money-in">Everyone's square. Nice.</p>
      )}
    </div>
  );
}
