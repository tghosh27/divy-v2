import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ShieldCheck, Sparkles } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { BackHeader, meta } from "@/components/SubScreen";
import { snapshotQuery } from "@/lib/divy-client";

export const Route = createFileRoute("/_authenticated/score")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () =>
    meta("Your Divy score", "See exactly what builds your Divy score and how to raise it."),
  component: ScoreScreen,
});

function ScoreScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const { score, rating, factors, tips } = data.scoreBreakdown;

  return (
    <AppShell>
      <BackHeader title="Divy score" />

      <div className="glass card-in mt-4 rounded-[28px] p-5 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-money-in/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-normal text-money-in">
          <ShieldCheck className="size-3" /> {rating}
        </span>
        <p className="num font-display mt-3 text-[56px] font-bold leading-none">{score}</p>
        <p className="mt-1 text-[12px] text-ink/50">out of 100 · updates as you settle up</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink/8">
          <div className="h-full rounded-full bg-money-in" style={{ width: `${score}%` }} />
        </div>
      </div>

      <p className="mt-6 text-[10px] font-semibold uppercase tracking-normal text-ink/45">
        What makes it up
      </p>

      <div className="glass card-in mt-3 divide-y divide-black/5 rounded-[24px] px-4" style={{ animationDelay: "0.05s" }}>
        {factors.map((f) => {
          const pct = f.max ? (f.points / f.max) * 100 : 0;
          const full = f.points >= f.max;
          return (
            <div key={f.key} className="py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-semibold">{f.label}</p>
                <p className="num shrink-0 text-[12px] font-bold">
                  <span className={full ? "text-money-in" : "text-ink"}>{f.points}</span>
                  <span className="text-ink/40">/{f.max}</span>
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/8">
                <div
                  className={`h-full rounded-full ${full ? "bg-money-in" : "bg-brand"}`}
                  style={{ width: `${Math.max(3, pct)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-ink/50">{f.detail}</p>
            </div>
          );
        })}
      </div>

      {tips.length > 0 ? (
        <>
          <p className="mt-6 text-[10px] font-semibold uppercase tracking-normal text-ink/45">
            How to raise it
          </p>
          <div className="glass card-in mt-3 rounded-[24px] p-4" style={{ animationDelay: "0.1s" }}>
            <ul className="space-y-2.5">
              {tips.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[12px] text-ink/70">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Sparkles className="size-3" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <p className="mt-5 px-1 text-[11px] leading-relaxed text-ink/45">
        Your score is calculated from your own activity only: how many settle-ups you closed before
        the due date, how quickly you pay once a window opens, whether charges you added get
        flagged, whether you owe anything in your groups, and how much you log. Nobody can see the
        details but you.
      </p>
    </AppShell>
  );
}
