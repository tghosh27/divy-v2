import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Bell, ChevronRight, Hourglass } from "lucide-react";

import { AppShell, money } from "@/components/AppShell";
import { coverSrc, avatarSrc } from "@/lib/divy-assets";
import { snapshotQuery } from "@/lib/divy-client";

export const Route = createFileRoute("/_authenticated/home")({
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(snapshotQuery);
    if (!data.me.onboarded) throw redirect({ to: "/onboarding" });
    return null;
  },
  head: () => ({
    meta: [
      { title: "Home — Divy It Up" },
      {
        name: "description",
        content:
          "Your overall standing across every group, the settle-ups that need action today, and your latest shared expenses.",
      },
      { property: "og:title", content: "Home — Divy It Up" },
      {
        property: "og:description",
        content: "Overall standing, overdue settle-ups to pay or confirm, and recent group expenses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomeScreen,
});

function HomeScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const { me, totals, actionItems, recentExpenses, groups } = data;

  return (
    <AppShell>
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
            Good evening
          </p>
          <p className="font-display text-[26px] font-bold leading-tight tracking-tight">
            {me.name.split(" ")[0]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/notifications"
            aria-label="Notifications"
            className="press relative grid size-10 place-items-center rounded-full bg-white/55 text-ink/60 outline-1 -outline-offset-1 outline-black/5"
          >
            <Bell className="size-4" />
            <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-money-out outline-2 outline-white" />
          </Link>
          <Link to="/profile" aria-label="Your profile" className="press">
            <img
              src={avatarSrc(me.avatarKey)}
              alt={me.name}
              width={40}
              height={40}
              className="size-10 rounded-full outline-1 -outline-offset-1 outline-black/5"
            />
          </Link>
        </div>
      </div>

      {/* hero standing */}
      <div className="glass card-in mt-5 rounded-[28px] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
          {totals.net < 0 ? "Overall you owe" : "Overall you're owed"}
        </p>
        <p
          className={`num mt-2 text-[44px] font-bold leading-none tracking-tight ${
            totals.net < 0 ? "text-money-out" : "text-money-in"
          }`}
        >
          ${Math.abs(totals.net).toFixed(2)}
        </p>
        <p className="mt-2 text-sm text-ink/55">Net across {totals.activeGroups} active groups</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-money-in/8 p-3 outline-1 -outline-offset-1 outline-money-in/20">
            <p className="text-[11px] font-medium text-ink/50">Owed to you</p>
            <p className="num mt-1 text-xl font-bold text-money-in">{money(totals.owedToYou)}</p>
          </div>
          <div className="rounded-2xl bg-money-out/8 p-3 outline-1 -outline-offset-1 outline-money-out/20">
            <p className="text-[11px] font-medium text-ink/50">You owe</p>
            <p className="num mt-1 text-xl font-bold text-money-out">{money(-totals.youOwe)}</p>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="glass card-in mt-7 rounded-[24px] p-6 text-center">
          <p className="text-sm font-semibold">No groups yet</p>
          <p className="mt-1 text-[12px] text-ink/55">
            Start a split or a shared wallet with your friends.
          </p>
          <Link
            to="/groups"
            className="press mt-4 inline-block rounded-full bg-brand px-4 py-2 text-[12px] font-bold text-white"
          >
            Go to groups
          </Link>
        </div>
      ) : (
        <>
          {/* action items */}
          <div className="mt-7 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Needs attention</h2>
            <span className="num rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">
              {actionItems.length}
            </span>
          </div>

          {actionItems.length === 0 ? (
            <div className="glass card-in mt-3 rounded-[22px] p-4 text-center text-[12px] text-ink/55">
              You're all caught up.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {actionItems.map((item, i) => (
                <div
                  key={item.id}
                  className="glass card-in flex items-center gap-3 rounded-[22px] p-3"
                  style={{ animationDelay: `${0.06 * (i + 1)}s` }}
                >
                  <Link
                    to="/group/$groupId"
                    params={{ groupId: item.groupId }}
                    className="press flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={coverSrc(item.coverKey)}
                        alt={item.group}
                        width={44}
                        height={44}
                        loading="lazy"
                        className="size-11 rounded-xl object-cover"
                      />
                      {item.badge && (
                        <span
                          className={`num absolute -left-1.5 -top-1.5 flex items-center gap-0.5 rounded-full py-[2px] pl-1 pr-1.5 text-[9px] font-bold leading-none text-white outline-2 outline-white ${
                            item.badge.tone === "urgent" ? "bg-money-out" : "bg-warn"
                          }`}
                        >
                          {item.badge.tone === "urgent" && (
                            <Hourglass className="size-2.5" aria-hidden />
                          )}
                          {item.badge.text}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.group}</p>
                      <p className="mt-0.5 flex items-baseline gap-1.5">
                        <span
                          className={`num text-sm font-bold ${item.amount < 0 ? "text-money-out" : "text-money-in"}`}
                        >
                          {money(item.amount)}
                        </span>
                        <span className="truncate text-[11px] text-ink/50">{item.note}</span>
                      </p>
                    </div>
                  </Link>
                  <Link
                    to={item.cta === "View" ? "/group/$groupId" : "/settle/$groupId"}
                    params={{ groupId: item.groupId }}
                    className={`press shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold ${
                      item.tone === "urgent"
                        ? "bg-money-out text-white"
                        : item.tone === "open"
                          ? "bg-brand text-white"
                          : item.tone === "warn"
                            ? "bg-warn text-white"
                            : "bg-white/70 text-ink outline-1 -outline-offset-1 outline-black/8"
                    }`}
                  >
                    {item.cta}
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* recent activity */}
          <div className="mt-7 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Recent expenses</h2>
            <Link to="/activity" className="flex items-center gap-0.5 text-xs font-semibold text-brand">
              See all <ChevronRight className="size-3.5" />
            </Link>
          </div>

          {recentExpenses.length === 0 ? (
            <div className="glass card-in mt-3 rounded-[24px] p-4 text-center text-[12px] text-ink/55">
              No expenses yet.
            </div>
          ) : (
            <div className="glass card-in mt-3 divide-y divide-black/5 rounded-[24px] px-4" style={{ animationDelay: "0.3s" }}>
              {recentExpenses.map((e) => (
                <Link
                  key={e.id}
                  to="/expense/$expenseId"
                  params={{ expenseId: e.id }}
                  className="press flex items-center gap-3 py-3.5"
                >
                  <img
                    src={coverSrc(e.coverKey)}
                    alt={e.group}
                    width={36}
                    height={36}
                    loading="lazy"
                    className="size-9 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{e.title}</p>
                    <p className="truncate text-[11px] text-ink/50">
                      {e.group} · {e.date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num text-sm font-bold">${e.total.toFixed(2)}</p>
                    <p className="num text-[11px] text-ink/45">${e.each.toFixed(2)}/ea</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
