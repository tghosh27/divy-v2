import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Receipt, ArrowDownLeft, Clock, BellRing, Check } from "lucide-react";

import { AppShell, ScreenHeader, money } from "@/components/AppShell";
import { avatarSrc } from "@/lib/divy-assets";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { markActivityRead } from "@/lib/divy.functions";
import type { ActivityEvent, Friend } from "@/lib/divy-types";

export const Route = createFileRoute("/_authenticated/activity")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () => ({
    meta: [
      { title: "Activity — Divy It Up" },
      {
        name: "description",
        content:
          "Your money pulse: net balance per person, spending mix this cycle, and a live feed of expenses, payments and cycle events.",
      },
      { property: "og:title", content: "Activity — Divy It Up" },
      {
        property: "og:description",
        content: "Per-person balances, cycle spending insights, and a live feed of group money events.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActivityScreen,
});

const tabs = ["All", "Friends"] as const;
type Tab = (typeof tabs)[number];

const kindMeta = {
  expense: { icon: Receipt, tint: "bg-brand-soft text-brand" },
  payment: { icon: ArrowDownLeft, tint: "bg-money-in/12 text-money-in" },
  cycle: { icon: Clock, tint: "bg-white/70 text-ink/60" },
  reminder: { icon: BellRing, tint: "bg-money-out/12 text-money-out" },
} as const;

function ActivityScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const refresh = useRefreshSnapshot();
  const markRead = useServerFn(markActivityRead);
  const [tab, setTab] = useState<Tab>("All");

  const { activityFeed, peopleBalances, spendingMix, monthlyRecap, friends } = data;
  const totalSpend = spendingMix.reduce((a, b) => a + b.value, 0);
  const feed = activityFeed;

  async function handleMarkAllRead() {
    await markRead();
    await refresh();
  }

  return (
    <AppShell>
      <ScreenHeader
        title="Activity"
        right={
          <button
            onClick={handleMarkAllRead}
            className="press flex items-center gap-1 text-xs font-semibold text-brand"
          >
            <Check className="size-3.5" /> Mark all read
          </button>
        }
      />

      {/* tabs */}
      <div className="mt-4 flex gap-2 pb-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`press shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold ${
              tab === t
                ? "bg-brand text-white"
                : "bg-white/60 text-ink/60 outline-1 -outline-offset-1 outline-black/5"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Friends" ? (
        <FriendsTab friends={friends} />
      ) : (
        <>
      {/* insights */}
      <p className="mt-6 text-[10px] font-semibold uppercase tracking-normal text-ink/45">
        Insights · this cycle
      </p>


      <div className="glass card-in mt-3 rounded-[24px] p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">Monthly recap</p>
          <p className="text-[11px] text-ink/45">{monthlyRecap.month}</p>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="num text-xl font-bold">${monthlyRecap.total.toFixed(2)}</p>
            <p className="text-[11px] text-ink/50">{monthlyRecap.expenseCount} expenses</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold">{monthlyRecap.topCategory}</p>
            <p className="text-[11px] text-ink/50">${monthlyRecap.topCategoryTotal.toFixed(2)} top category</p>
          </div>
        </div>
      </div>

      {peopleBalances.length > 0 ? (
        <div className="glass card-in mt-3 rounded-[24px] p-4" style={{ animationDelay: "0.04s" }}>
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">People balances</p>
            <p className="text-[11px] text-ink/45">Net across all groups</p>
          </div>
          <div className="mt-3 space-y-2.5">
            {peopleBalances.map((p) => {
              const pct = (Math.abs(p.amount) / 120) * 100;
              const positive = p.amount > 0;
              return (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 truncate text-xs font-medium text-ink/70">
                    {p.name}
                  </span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink/8">
                    <div
                      className={`h-full rounded-full ${positive ? "bg-money-in" : "bg-money-out"}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <span
                    className={`num w-16 shrink-0 text-right text-xs font-bold ${
                      positive ? "text-money-in" : "text-money-out"
                    }`}
                  >
                    {money(p.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {totalSpend > 0 ? (
        <div className="glass card-in mt-3 rounded-[24px] p-4" style={{ animationDelay: "0.08s" }}>
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">Spending mix</p>
            <p className="num text-[11px] text-ink/45">${totalSpend.toLocaleString()} this cycle</p>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <Donut spendingMix={spendingMix} totalSpend={totalSpend} />
            <ul className="flex-1 space-y-1.5">
              {spendingMix.map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-xs">
                  <span className="size-2 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 text-ink/65">{s.label}</span>
                  <span className="num font-semibold">${s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* feed */}
      <p className="mt-7 text-[10px] font-semibold uppercase tracking-normal text-ink/45">
        Feed
      </p>
      {feed.length === 0 ? (
        <div className="glass card-in mt-3 rounded-[24px] p-6 text-center text-[12px] text-ink/55" style={{ animationDelay: "0.14s" }}>
          Nothing here yet.
        </div>
      ) : (
        <div className="glass card-in mt-3 divide-y divide-black/5 rounded-[24px] px-4" style={{ animationDelay: "0.14s" }}>
          {feed.map((f) => {
            const m = kindMeta[f.kind];
            const Icon = m.icon;
            return (
              <div key={f.id} className="flex items-start gap-3 py-3.5">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${m.tint}`}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug">
                    <span className="font-semibold">{f.who}</span>{" "}
                    <span className="text-ink/65">{f.text}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink/40">{f.when}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {f.amount !== null ? (
                    <span
                      className={`num text-sm font-bold ${f.amount < 0 ? "text-money-out" : "text-money-in"}`}
                    >
                      {money(f.amount)}
                    </span>
                  ) : null}
                  {f.unread ? <span className="size-1.5 rounded-full bg-brand" /> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </AppShell>
  );
}

function FriendsTab({ friends }: { friends: Friend[] }) {
  if (friends.length === 0) {
    return (
      <div className="glass card-in mt-5 rounded-[24px] p-6 text-center text-[12px] text-ink/55">
        No friends yet — add people to a group and they'll show up here.
      </div>
    );
  }
  return (
    <>
      <p className="mt-6 text-[10px] font-semibold uppercase tracking-normal text-ink/45">
        {friends.length} {friends.length === 1 ? "friend" : "friends"} · net across all groups
      </p>
      <div className="mt-3 space-y-3">
        {friends.map((f, i) => (
          <div
            key={f.handle}
            className="glass card-in rounded-[24px] p-4"
            style={{ animationDelay: `${0.04 * i}s` }}
          >
            <div className="flex items-center gap-3">
              <ScoreRing score={f.score} avatarKey={f.avatarKey} name={f.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{f.name}</p>
                <p className="truncate text-[11px] text-ink/45">
                  {f.handle} · {f.shared} {f.shared === 1 ? "group" : "groups"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`num text-sm font-bold ${
                    f.net > 0 ? "text-money-in" : f.net < 0 ? "text-money-out" : "text-ink/45"
                  }`}
                >
                  {f.net === 0 ? "Settled" : money(f.net)}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 border-t border-black/5 pt-3">
              {f.ties.map((t) => (
                <Link
                  key={t.groupId}
                  to="/group/$groupId"
                  params={{ groupId: t.groupId }}
                  className="press flex items-center gap-2 text-[12px]"
                >
                  <span className="min-w-0 flex-1 truncate text-ink/65">{t.group}</span>
                  <span
                    className={`num shrink-0 font-semibold ${
                      t.amount > 0 ? "text-money-in" : t.amount < 0 ? "text-money-out" : "text-ink/40"
                    }`}
                  >
                    {t.amount === 0 ? "—" : money(t.amount)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// Divy score ring: wraps the avatar, darkens as the score drops, red at the bottom.
const SCORE_TIERS: { min: number; color: string }[] = [
  { min: 90, color: "#059669" }, // excellent — green
  { min: 75, color: "#4d7c0f" }, // strong — darker olive green
  { min: 60, color: "#b45309" }, // fair — dark amber
  { min: 40, color: "#9f1239" }, // building — dark red
  { min: 0, color: "#e11d48" }, // lowest — red
];

function scoreColor(score: number): string {
  for (const t of SCORE_TIERS) if (score >= t.min) return t.color;
  return "#e11d48";
}

function ScoreRing({ score, avatarKey, name }: { score: number; avatarKey: string; name: string }) {
  const color = scoreColor(score);
  const r = 25;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="relative size-[58px] shrink-0" title={`Divy score ${score}`}>
      <svg viewBox="0 0 58 58" className="absolute inset-0 -rotate-90">
        <circle cx="29" cy="29" r={r} fill="none" stroke="#00000012" strokeWidth="4" />
        <circle
          cx="29"
          cy="29"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c - pct * c}`}
        />
      </svg>
      <img
        src={avatarSrc(avatarKey)}
        alt={name}
        width={42}
        height={42}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full outline-1 -outline-offset-1 outline-black/5"
        style={{ width: 40, height: 40 }}
      />
      <span
        className="num absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-px text-[10px] font-bold leading-[14px] text-white"
        style={{ background: color, boxShadow: "0 0 0 2px #f9f8ff" }}
      >
        {score}
      </span>
    </div>
  );
}

function Donut({
  spendingMix,
  totalSpend,
}: {
  spendingMix: { label: string; value: number; color: string }[];
  totalSpend: number;
}) {
  const r = 30;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 80 80" className="size-[92px] shrink-0 -rotate-90">
      {spendingMix.map((s) => {
        const len = (s.value / totalSpend) * c;
        const el = (
          <circle
            key={s.label}
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="12"
            strokeLinecap="butt"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}
