import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Plus,
  ArrowUpRight,
  Landmark,
  Send,
  CreditCard,
  ShieldCheck,
  ChevronDown,
  Users,
  Megaphone,
} from "lucide-react";

import { AppShell, money } from "@/components/AppShell";
import { avatarSrc } from "@/lib/divy-assets";
import { snapshotQuery } from "@/lib/divy-client";

export const Route = createFileRoute("/_authenticated/wallet")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () => ({
    meta: [
      { title: "Wallet — Divy It Up" },
      {
        name: "description",
        content:
          "Your Divy wallet: available and pending balance, linked bank, and every payment sent or received in your groups.",
      },
      { property: "og:title", content: "Wallet — Divy It Up" },
      {
        property: "og:description",
        content: "Available and pending wallet balance, add money, withdraw, and full payment history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WalletScreen,
});

function WalletScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const { me, wallet, walletTransactions, groups } = data;

  const sharedWallets = groups.filter((g) => g.kind === "wallet" && g.youAdmin);
  const cardCount = 1 + sharedWallets.length;

  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  const sharedGroup = active > 0 ? sharedWallets[active - 1] : undefined;
  const sharedDetail = sharedGroup ? data.groupDetails[sharedGroup.id] : undefined;

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w > 0) setActive(Math.min(cardCount - 1, Math.round(el.scrollLeft / w)));
  };

  return (
    <AppShell>
      {/* identity */}
      <div className="flex items-center gap-3">
        <img
          src={avatarSrc(me.avatarKey)}
          alt={me.name}
          width={52}
          height={52}
          className="rounded-full outline-1 -outline-offset-1 outline-black/5"
          style={{ width: 52, height: 52 }}
        />
        <Link to="/profile" className="press min-w-0 flex-1">
          <p className="font-display text-xl font-bold leading-tight">{me.name}</p>
          <p className="text-xs text-ink/50">{me.handle || "Set a handle"}</p>
        </Link>
        <Link
          to="/score"
          className="press flex items-center gap-1.5 rounded-full bg-money-in/10 px-3 py-1.5 outline-1 -outline-offset-1 outline-money-in/25"
        >
          <ShieldCheck className="size-3.5 text-money-in" />
          <span className="num text-xs font-bold text-money-in">{me.score}</span>
        </Link>
      </div>

      {/* wallet cards — swipe between personal and shared wallets */}
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="card-in mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="w-full shrink-0 snap-center overflow-hidden rounded-[28px] bg-brand p-5 text-white shadow-[0_20px_50px_-16px_rgba(124,58,237,0.65)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-white/20">
                <CreditCard className="size-3.5" />
              </span>
              <p className="text-xs font-semibold">Personal wallet</p>
            </div>
            <span className="rounded-full bg-white/18 px-2.5 py-1 text-[10px] font-bold">
              Bank linked
            </span>
          </div>

          <p className="num mt-4 text-[42px] font-bold leading-none tracking-tight">
            ${wallet.available.toFixed(2)}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/12 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-normal text-white/70">
                Available
              </p>
              <p className="num mt-1 text-lg font-bold">${wallet.available.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl bg-white/12 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-normal text-white/70">
                Pending
              </p>
              <p className="num mt-1 text-lg font-bold">${wallet.pending.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {sharedWallets.map((g) => (
          <Link
            key={g.id}
            to="/group/$groupId"
            params={{ groupId: g.id }}
            className="block w-full shrink-0 snap-center overflow-hidden rounded-[28px] bg-ink p-5 text-white shadow-[0_20px_50px_-16px_rgba(36,26,61,0.55)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-white/15">
                  <Users className="size-3.5" />
                </span>
                <p className="max-w-44 truncate text-xs font-semibold">{g.name}</p>
              </div>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold">
                Shared · Treasurer
              </span>
            </div>

            <p className="num mt-4 text-[42px] font-bold leading-none tracking-tight">
              ${g.available.toFixed(2)}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-normal text-white/60">
                  In the wallet
                </p>
                <p className="num mt-1 text-lg font-bold">${g.available.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-normal text-white/60">
                  Members
                </p>
                <p className="num mt-1 text-lg font-bold">{g.members}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {cardCount > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {Array.from({ length: cardCount }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-5 bg-brand" : "w-1.5 bg-ink/15"
              }`}
            />
          ))}
        </div>
      )}

      {/* actions — swap to the shared wallet's when you swipe to its card */}
      {sharedDetail ? (
        <div className="card-in mt-4 grid grid-cols-4 gap-2.5" style={{ animationDelay: "0.06s" }}>
          <Link
            to="/contribute/$groupId"
            params={{ groupId: sharedDetail.id }}
            className="press glass flex flex-col items-center gap-1.5 rounded-2xl py-3"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
              <Plus className="size-4" />
            </span>
            <span className="text-[10px] font-semibold">Pay</span>
          </Link>
          <Link
            to="/wallet-out/$groupId"
            params={{ groupId: sharedDetail.id }}
            className="press glass flex flex-col items-center gap-1.5 rounded-2xl py-3"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
              <ArrowUpRight className="size-4" />
            </span>
            <span className="text-[10px] font-semibold">Transfer out</span>
          </Link>
          <Link
            to="/funding-new/$groupId"
            params={{ groupId: sharedDetail.id }}
            className="press glass flex flex-col items-center gap-1.5 rounded-2xl py-3"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
              <Megaphone className="size-4" />
            </span>
            <span className="text-[10px] font-semibold">New request</span>
          </Link>
          <Link
            to="/group/$groupId"
            params={{ groupId: sharedDetail.id }}
            className="press glass flex flex-col items-center gap-1.5 rounded-2xl py-3"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
              <Users className="size-4" />
            </span>
            <span className="text-[10px] font-semibold">Open group</span>
          </Link>
        </div>
      ) : (
        <div className="card-in mt-4 grid grid-cols-4 gap-2.5" style={{ animationDelay: "0.06s" }}>
          {[
            { icon: Plus, label: "Add money", to: "/wallet-add" as const },
            { icon: ArrowUpRight, label: "Withdraw", to: "/wallet-withdraw" as const },
            { icon: Landmark, label: "Accounts", to: "/wallet-accounts" as const },
            { icon: Send, label: "Send", to: "/wallet-send" as const },
          ].map(({ icon: Icon, label, to }) => (
            <Link
              key={label}
              to={to}
              className="press glass flex flex-col items-center gap-1.5 rounded-2xl py-3"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-4" />
              </span>
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* transactions — the shared wallet's money log when its card is showing */}
      {sharedDetail ? (
        <div className="glass card-in mt-6 rounded-[24px] px-4" style={{ animationDelay: "0.12s" }}>
          <p className="py-3.5 text-sm font-semibold">{sharedDetail.name} · money log</p>
          {!sharedDetail.wallet || sharedDetail.wallet.deposits.length === 0 ? (
            <div className="border-t border-black/5 py-6 text-center text-[12px] text-ink/55">
              No money in or out yet.
            </div>
          ) : (
            <>
              <div className="divide-y divide-black/5 border-t border-black/5">
                {sharedDetail.wallet.deposits.map((d) => {
                  const positive = d.amount > 0;
                  return (
                    <div key={d.id} className="flex items-center gap-3 py-3.5">
                      <span
                        className={`num grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${
                          positive ? "bg-money-in/12 text-money-in" : "bg-money-out/12 text-money-out"
                        }`}
                      >
                        {d.name.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{d.name}</p>
                        <p className="truncate text-[11px] text-ink/50">
                          {positive ? "Dues in" : "Paid out"} · {d.date}
                          {d.pending ? " · clearing" : ""}
                        </p>
                      </div>
                      <p
                        className={`num text-sm font-bold ${positive ? "text-money-in" : "text-money-out"}`}
                      >
                        {money(d.amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
              <Link
                to="/group/$groupId"
                params={{ groupId: sharedDetail.id }}
                className="press flex w-full items-center justify-center gap-1 border-t border-black/5 py-3.5 text-xs font-semibold text-brand"
              >
                Open the full money log <ChevronDown className="size-3.5" />
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="glass card-in mt-6 rounded-[24px] px-4" style={{ animationDelay: "0.12s" }}>
          <p className="py-3.5 text-sm font-semibold">Recent transactions</p>
          {walletTransactions.length === 0 ? (
            <div className="border-t border-black/5 py-6 text-center text-[12px] text-ink/55">
              No transactions yet.
            </div>
          ) : (
            <>
              <div className="divide-y divide-black/5 border-t border-black/5">
                {walletTransactions.map((t) => {
                  const positive = t.amount > 0;
                  return (
                    <div key={t.id} className="flex items-center gap-3 py-3.5">
                      <span
                        className={`num grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${
                          positive ? "bg-money-in/12 text-money-in" : "bg-money-out/12 text-money-out"
                        }`}
                      >
                        {t.name.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{t.name}</p>
                        <p className="truncate text-[11px] text-ink/50">
                          {t.note} · {t.date}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`num text-sm font-bold ${positive ? "text-money-in" : "text-money-out"}`}
                        >
                          {money(t.amount)}
                        </p>
                        <p className="text-[10px] text-ink/40">{positive ? "Received" : "Sent"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link
                to="/history"
                className="press flex w-full items-center justify-center gap-1 border-t border-black/5 py-3.5 text-xs font-semibold text-brand"
              >
                See all transactions <ChevronDown className="size-3.5" />
              </Link>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
