import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, SlidersHorizontal, Archive, Check, GripVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AppShell, ScreenHeader, money } from "@/components/AppShell";
import { coverSrc, avatarSrc } from "@/lib/divy-assets";
import { snapshotQuery } from "@/lib/divy-client";
import type { CycleState } from "@/lib/divy-types";

export const Route = createFileRoute("/_authenticated/groups")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () => ({
    meta: [
      { title: "Groups — Divy It Up" },
      {
        name: "description",
        content:
          "Every group you're in: where you stand, how far along the settlement cycle is, and what's overdue.",
      },
      { property: "og:title", content: "Groups — Divy It Up" },
      {
        property: "og:description",
        content: "Group cards with your balance and settlement cycle progress at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupsScreen,
});

const cycleStyles: Record<CycleState, { chip: string; bar: string; label: string }> = {
  overdue: { chip: "bg-money-out/12 text-money-out", bar: "bg-money-out", label: "Overdue" },
  settling: { chip: "bg-brand-soft text-brand", bar: "bg-brand", label: "Settling" },
  open: { chip: "bg-white/70 text-ink/60", bar: "bg-brand/50", label: "Open" },
  settled: { chip: "bg-money-in/12 text-money-in", bar: "bg-money-in", label: "Settled" },
};

type SortMode = "soonest" | "amount" | "custom";

const SORT_LABEL: Record<SortMode, string> = {
  soonest: "Closes soonest",
  amount: "Highest amount",
  custom: "Your order",
};

const cycleRank: Record<CycleState, number> = { overdue: 0, settling: 1, open: 2, settled: 3 };
const CUSTOM_KEY = "divy-group-order";

function readCustomOrder(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function GroupsScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const { totals } = data;
  const groups = data.groups.filter((g) => !g.archived);
  const archivedCount = data.groups.length - groups.length;

  const [sort, setSort] = useState<SortMode>("soonest");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    setCustomOrder(readCustomOrder());
  }, []);

  function persist(ids: string[]) {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }

  function currentIds() {
    const base = customOrder.length ? [...customOrder] : sorted.map((g) => g.id);
    for (const g of groups) if (!base.includes(g.id)) base.push(g.id);
    return base;
  }

  function onGripDown(e: React.PointerEvent, id: string) {
    e.preventDefault();
    dragId.current = id;
    setDraggingId(id);
    let latest = currentIds();

    const onMove = (ev: PointerEvent) => {
      const active = dragId.current;
      if (!active) return;
      const el = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest("[data-group-card]");
      const overId = el?.getAttribute("data-group-card");
      if (!overId || overId === active) return;
      const from = latest.indexOf(active);
      const to = latest.indexOf(overId);
      if (from === -1 || to === -1) return;
      latest = [...latest];
      latest.splice(from, 1);
      latest.splice(to, 0, active);
      setCustomOrder(latest);
    };
    const onUp = () => {
      dragId.current = null;
      setDraggingId(null);
      persist(latest);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  const sorted = [...groups].sort((a, b) => {
    if (sort === "amount") {
      const amt = (g: (typeof groups)[number]) =>
        g.kind === "wallet" ? g.available : Math.abs(g.balance);
      return amt(b) - amt(a);
    }
    if (sort === "custom") {
      const rank = (g: (typeof groups)[number]) => {
        const i = customOrder.indexOf(g.id);
        return i === -1 ? customOrder.length : i;
      };
      return rank(a) - rank(b);
    }
    return cycleRank[a.cycle] - cycleRank[b.cycle] || b.progress - a.progress;
  });

  return (
    <AppShell>
      <ScreenHeader
        eyebrow="Good evening"
        title="My Groups"
        right={
          <Link
            to="/archive"
            aria-label={`Archived groups${archivedCount ? ` (${archivedCount})` : ""}`}
            className="press relative grid size-10 place-items-center rounded-full bg-white/55 text-ink/60 outline-1 -outline-offset-1 outline-black/5"
          >
            <Archive className="size-4" />
            {archivedCount ? (
              <span className="num absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-white outline-2 -outline-offset-1 outline-white">
                {archivedCount}
              </span>
            ) : null}
          </Link>
        }
      />

      {/* net balance */}
      <div className="glass card-in mt-5 rounded-[28px] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
          Net balance
        </p>
        <div className="mt-3 flex items-stretch">
          <div className="flex-1">
            <p className="text-[11px] font-medium text-ink/50">You owe</p>
            <p className="num mt-1 text-[26px] font-bold leading-none text-money-out">
              ${totals.youOwe.toFixed(2)}
            </p>
          </div>
          <div className="mx-4 w-px bg-black/8" />
          <div className="flex-1">
            <p className="text-[11px] font-medium text-ink/50">You are owed</p>
            <p className="num mt-1 text-[26px] font-bold leading-none text-money-in">
              ${totals.owedToYou.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-semibold">Active groups</h2>
          <Link
            to="/create-group"
            className="press flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand"
          >
            <Plus className="size-3" /> New
          </Link>
        </div>
        <div className="relative">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="press flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-ink/70 outline-1 -outline-offset-1 outline-black/5"
          >
            <SlidersHorizontal className="size-3" /> {SORT_LABEL[sort]}
          </button>
          {pickerOpen ? (
            <>
              <button
                aria-label="Close"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setPickerOpen(false)}
              />
              <div className="glass absolute right-0 z-20 mt-2 w-44 rounded-2xl p-1.5">
                {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setSort(m);
                      setPickerOpen(false);
                    }}
                    className="press flex w-full items-center justify-between rounded-xl px-3 py-2 text-[12px] font-semibold text-ink/75 hover:bg-black/4"
                  >
                    {SORT_LABEL[m]}
                    {sort === m ? <Check className="size-3.5 text-brand" /> : null}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="glass card-in mt-4 rounded-[24px] p-6 text-center">
          <p className="text-sm font-semibold">No groups yet</p>
          <p className="mt-1 text-[12px] text-ink/55">
            Create a split or shared wallet to get started.
          </p>
          <Link
            to="/create-group"
            className="press mt-4 inline-block rounded-full bg-brand px-4 py-2 text-[12px] font-bold text-white"
          >
            Create a group
          </Link>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {sort === "custom" ? (
            <p className="text-[11px] text-ink/45">
              Drag the grip on any card to set your own order — it's remembered on this device.
            </p>
          ) : null}
          {sorted.map((g, i) => {
            const s = cycleStyles[g.cycle];
            return (
              <div
                key={g.id}
                data-group-card={g.id}
                className={`glass card-in rounded-[24px] p-4 transition-shadow ${
                  draggingId === g.id ? "shadow-[0_18px_40px_-12px_rgba(124,58,237,0.45)]" : ""
                }`}
                style={{ animationDelay: `${0.06 * (i + 1)}s` }}
              >
                <Link to="/group/$groupId" params={{ groupId: g.id }} className="press block">
                <div className="flex items-start gap-3">
                  <img
                    src={coverSrc(g.coverKey)}
                    alt={g.name}
                    width={52}
                    height={52}
                    loading="lazy"
                    className="size-13 shrink-0 rounded-2xl object-cover"
                    style={{ width: 52, height: 52 }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{g.name}</p>
                    <p className="mt-0.5 text-[11px] text-ink/50">{g.lastActivity}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {g.kind === "wallet" ? (
                      <>
                        <p className="num text-lg font-bold leading-none text-money-in">
                          ${g.available.toFixed(2)}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink/45">
                          In wallet
                        </p>
                      </>
                    ) : (
                    <>
                    <p
                      className={`num text-lg font-bold leading-none ${
                        g.balance === 0
                          ? "text-ink/70"
                          : g.balance < 0
                            ? "text-money-out"
                            : "text-money-in"
                      }`}
                    >
                      {g.balance === 0 ? "$0.00" : money(g.balance)}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink/45">
                      {g.balance === 0 ? "All even" : g.balance < 0 ? "You owe" : "You're owed"}
                    </p>
                    </>
                    )}
                  </div>
                </div>

                {/* cycle progress */}
                <div className="mt-3.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        g.kind === "wallet" ? "bg-money-in/12 text-money-in" : s.chip
                      }`}
                    >
                      {g.kind === "wallet" ? "Shared wallet" : s.label}
                    </span>
                    <span className="text-[11px] text-ink/50">{g.cycleLabel}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/8">
                    <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${g.progress}%` }} />
                  </div>
                </div>
                </Link>

                <div className="mt-3 flex items-center justify-between">
                  {sort === "custom" ? (
                    <button
                      aria-label={`Drag to reorder ${g.name}`}
                      onPointerDown={(e) => onGripDown(e, g.id)}
                      className={`press flex touch-none items-center gap-1 rounded-full bg-white/70 px-3 py-2 text-[11px] font-semibold text-ink/60 outline-1 -outline-offset-1 outline-black/8 ${
                        draggingId === g.id ? "cursor-grabbing" : "cursor-grab"
                      }`}
                    >
                      <GripVertical className="size-4" /> Drag
                    </button>
                  ) : null}
                  {sort !== "custom" ? (
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {g.memberAvatars.slice(0, 3).map((a, k) => (
                        <img
                          key={k}
                          src={avatarSrc(a)}
                          alt="Group member"
                          width={24}
                          height={24}
                          loading="lazy"
                          className="size-6 rounded-full outline-2 -outline-offset-1 outline-white"
                        />
                      ))}
                      {g.members > 3 ? (
                        <div className="num grid size-6 place-items-center rounded-full bg-ink text-[9px] font-bold text-white outline-2 -outline-offset-1 outline-white">
                          +{g.members - 3}
                        </div>
                      ) : null}
                    </div>
                    <span className="text-[11px] text-ink/45">{g.members} members</span>
                  </div>
                  ) : null}
                  {g.kind === "wallet" ? (
                    <Link
                      to="/contribute/$groupId"
                      params={{ groupId: g.id }}
                      className="press rounded-full bg-brand px-3.5 py-1.5 text-[11px] font-bold text-white"
                    >
                      Pay
                    </Link>
                  ) : g.cycle === "overdue" ? (
                    <Link
                      to="/settle/$groupId"
                      params={{ groupId: g.id }}
                      className="press rounded-full bg-money-out px-3.5 py-1.5 text-[11px] font-bold text-white"
                    >
                      Pay
                    </Link>
                  ) : (
                    <Link
                      to="/group/$groupId"
                      params={{ groupId: g.id }}
                      className="press rounded-full bg-white/70 px-3.5 py-1.5 text-[11px] font-bold text-ink outline-1 -outline-offset-1 outline-black/8"
                    >
                      View
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
