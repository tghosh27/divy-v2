import { createFileRoute, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowRight, Check, Landmark, ShieldCheck, Wallet, Zap } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AmountPad, BackHeader, BigAmount, PrimaryButton, meta } from "@/components/SubScreen";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { nudgeGroup, requestSettleUp, settleGroup, startSettleUp } from "@/lib/divy.functions";
import { avatarSrc } from "@/lib/divy-assets";
import type { GroupDetail } from "@/lib/divy-types";
import { SettleProgress } from "@/components/SettleProgress";

export const Route = createFileRoute("/_authenticated/settle/$groupId")({
  loader: async ({ context, params }) => {
    const snapshot = await context.queryClient.ensureQueryData(snapshotQuery);
    const detail = snapshot.groupDetails[params.groupId];
    if (!detail) throw notFound();
    if (detail.wallet !== null) {
      throw redirect({ to: "/contribute/$groupId", params: { groupId: params.groupId } });
    }
    return snapshot;
  },
  head: () => meta("Settle up", "Pay off what you owe in your group."),
  component: SettleScreen,
});

function SettleScreen() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(snapshotQuery);
  const navigate = useNavigate();
  const refresh = useRefreshSnapshot();
  const doSettle = useServerFn(settleGroup);

  const detail = data.groupDetails[params.groupId];
  if (!detail) return null;

  const due = Math.abs(Math.min(0, detail.balance));

  const [amount, setAmount] = useState(due.toFixed(2));
  const [padOpen, setPadOpen] = useState(false);
  const [source, setSource] = useState("wallet");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const num = parseFloat(amount) || 0;
  const partial = num > 0 && num < due;

  if (detail.balance > 0) {
    return <RequestPayout detail={detail} groupId={params.groupId} />;
  }

  if (detail.cycle !== "settling" && detail.cycle !== "overdue") {
    return <NoWindow detail={detail} groupId={params.groupId} />;
  }

  const sources = [
    {
      id: "wallet",
      icon: Wallet,
      name: "Divy wallet",
      detail: `$${data.wallet.available.toFixed(2)} available`,
      instant: true,
    },
    ...data.linkedAccounts.map((a) => ({
      id: a.id,
      icon: Landmark,
      name: a.name,
      detail: a.detail,
      instant: false,
    })),
  ];

  async function pay() {
    if (num <= 0 || busy) return;
    setBusy(true);
    const sourceName = sources.find((s) => s.id === source)?.name ?? "Divy wallet";
    await doSettle({ data: { groupId: params.groupId, amount: num, source: sourceName, kind: "settle" } });
    await refresh();
    setDone(true);
    setTimeout(() => navigate({ to: "/group/$groupId", params: { groupId: params.groupId } }), 1100);
  }

  return (
    <AppShell>
      <BackHeader eyebrow="Settle up" title={detail.name} />

      {detail.cycle === "overdue" ? (
        <div className="card-in mt-4 flex items-center gap-2.5 rounded-[18px] bg-money-out/10 p-3 outline-1 -outline-offset-1 outline-money-out/25">
          <Zap className="size-4 shrink-0 text-money-out" />
          <p className="text-[12px] font-semibold text-money-out">{detail.cycleLabel}</p>
        </div>
      ) : null}

      <BigAmount
        value={amount}
        hint={`Paying · tap to ${padOpen ? "hide" : "edit"} · $${due.toFixed(2)} due`}
        onTap={() => setPadOpen((v) => !v)}
      />

      {padOpen ? <AmountPad value={amount} onChange={setAmount} max={due} /> : null}

      <SettleProgress detail={detail} />

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setAmount(due.toFixed(2))}
          className={`press flex-1 rounded-full py-2 text-[11px] font-bold ${
            num === due ? "bg-brand text-white" : "glass text-ink/65"
          }`}
        >
          Pay in full
        </button>
        <button
          onClick={() => setAmount((due / 2).toFixed(2))}
          className={`press flex-1 rounded-full py-2 text-[11px] font-bold ${
            partial ? "bg-brand text-white" : "glass text-ink/65"
          }`}
        >
          Pay half
        </button>
      </div>

      <SimplifiedPayments detail={detail} />

      <p className="mt-6 px-1 text-[10px] font-semibold uppercase tracking-normal text-ink/45">
        Pay from
      </p>
      <div className="mt-2 space-y-2">
        {sources.map((s) => (
          <button
            key={s.id}
            onClick={() => setSource(s.id)}
            className={`press glass flex w-full items-center gap-3 rounded-[20px] p-3.5 text-left transition-shadow ${
              source === s.id ? "shadow-[0_14px_32px_-14px_rgba(124,58,237,0.55)]" : ""
            }`}
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                source === s.id ? "bg-brand text-white" : "bg-brand-soft text-brand"
              }`}
            >
              <s.icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{s.name}</p>
              <p className="text-[11px] text-ink/50">
                {s.detail}
                {s.instant ? " · instant" : " · 1–2 business days"}
              </p>
            </div>
            {source === s.id ? (
              <span className="grid size-5 place-items-center rounded-full bg-brand text-white">
                <Check className="size-3" />
              </span>
            ) : (
              <span className="size-5 rounded-full outline-1 -outline-offset-1 outline-black/12" />
            )}
          </button>
        ))}
      </div>

      <div className="glass card-in mt-4 rounded-[22px] p-4">
        <div className="divide-y divide-black/5">
          <SumRow label="Amount" value={`$${num.toFixed(2)}`} />
          <SumRow label="Fee" value="$0.00" />
          <SumRow
            label={partial ? "Remaining after payment" : "Remaining"}
            value={`$${Math.max(due - num, 0).toFixed(2)}`}
          />
        </div>
      </div>

      {done ? (
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="celebrate-badge grid size-16 place-items-center rounded-full bg-money-in text-white shadow-[0_16px_36px_-12px_rgba(16,185,129,0.7)]">
            <Check className="size-8" />
          </div>
          <p className="text-sm font-bold text-money-in">Payment sent!</p>
        </div>
      ) : (
        <PrimaryButton onClick={pay} disabled={num <= 0 || busy}>
          {busy ? "Sending…" : num > 0 ? `Pay $${num.toFixed(2)}` : "Enter an amount"}
        </PrimaryButton>
      )}

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-ink/45">
        <ShieldCheck className="size-3.5" /> Protected by Divy settlement guarantee
      </p>

      <style>{`
        .celebrate-badge {
          animation: celebrate-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes celebrate-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </AppShell>
  );
}

function RequestPayout({ detail, groupId }: { detail: GroupDetail; groupId: string }) {
  const navigate = useNavigate();
  const refresh = useRefreshSnapshot();
  const nudge = useServerFn(nudgeGroup);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);

  const owed = detail.balance;
  const debtors = detail.members.filter((m) => m.balance < -0.005);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    const res = await nudge({ data: { groupId } });
    if (res.ok) setCount(res.count);
    await refresh();
    setDone(true);
    setTimeout(() => navigate({ to: "/group/$groupId", params: { groupId } }), 1400);
  }

  return (
    <AppShell>
      <BackHeader eyebrow="Request payout" title={detail.name} />

      <div className="mt-6 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">You're owed</p>
        <p className="num mt-1 font-display text-5xl font-bold tracking-tight text-money-in">
          ${owed.toFixed(2)}
        </p>
      </div>

      {debtors.length > 0 ? (
        <div className="glass card-in mt-6 rounded-[22px] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
            Who owes you
          </p>
          <div className="mt-1 divide-y divide-black/5">
            {debtors.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2.5">
                <img src={avatarSrc(m.avatarKey)} alt={m.name} className="size-9 rounded-full" />
                <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{m.name}</p>
                <p className="num text-[13px] font-bold text-money-out">
                  ${Math.abs(m.balance).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 px-1 text-center text-[12px] text-ink/50">
        Confirming lets everyone who owes you know it's time to pay.
      </p>

      {done ? (
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="celebrate-badge grid size-16 place-items-center rounded-full bg-money-in text-white shadow-[0_16px_36px_-12px_rgba(16,185,129,0.7)]">
            <Check className="size-8" />
          </div>
          <p className="text-sm font-bold text-money-in">
            Request sent{count > 0 ? ` · ${count} ${count === 1 ? "person" : "people"} nudged` : ""}!
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <PrimaryButton onClick={confirm} disabled={busy}>
            {busy ? "Sending…" : `Confirm payout of $${owed.toFixed(2)}`}
          </PrimaryButton>
        </div>
      )}

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-ink/45">
        <ShieldCheck className="size-3.5" /> Protected by Divy settlement guarantee
      </p>

      <style>{`
        .celebrate-badge {
          animation: celebrate-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes celebrate-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </AppShell>
  );
}

function SimplifiedPayments({ detail }: { detail: GroupDetail }) {
  const owe = detail.members.filter((m) => m.balance < -0.005);
  const owed = detail.members.filter((m) => m.balance > 0.005);
  if (!owe.length || !owed.length) return null;
  return (
    <div className="glass card-in mt-4 rounded-[24px] p-4">
      <p className="text-sm font-semibold">Simplified payments</p>
      <p className="mt-0.5 text-[11px] text-ink/50">
        Divy nets everything down to {owe.length} transfer{owe.length > 1 ? "s" : ""}
      </p>
      <div className="mt-3 space-y-2">
        {owe.map((from) => (
          <div
            key={from.id}
            className="flex items-center gap-2 rounded-2xl bg-white/55 p-2.5 outline-1 -outline-offset-1 outline-black/5"
          >
            <img src={avatarSrc(from.avatarKey)} alt="" className="size-7 rounded-full" />
            <span className="text-[12px] font-semibold">{from.name}</span>
            <ArrowRight className="size-3.5 text-ink/35" />
            <img src={avatarSrc(owed[0]!.avatarKey)} alt="" className="size-7 rounded-full" />
            <span className="text-[12px] font-semibold">{owed[0]!.name}</span>
            <span className="num ml-auto text-[12px] font-bold text-money-out">
              ${Math.abs(from.balance).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[13px] text-ink/55">{label}</span>
      <span className="num text-[13px] font-bold">{value}</span>
    </div>
  );
}

function NoWindow({ detail, groupId }: { detail: GroupDetail; groupId: string }) {
  const refresh = useRefreshSnapshot();
  const ask = useServerFn(requestSettleUp);
  const begin = useServerFn(startSettleUp);
  const [sent, setSent] = useState(false);
  const due = Math.abs(Math.min(0, detail.balance));

  async function request() {
    await ask({ data: { groupId } });
    setSent(true);
    await refresh();
  }

  async function start() {
    await begin({ data: { groupId } });
    await refresh();
  }

  return (
    <AppShell>
      <BackHeader eyebrow="Settle up" title={detail.name} />

      <div className="glass card-in mt-4 rounded-[26px] p-5 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
          <ShieldCheck className="size-5" />
        </span>
        <p className="mt-3 text-sm font-bold">No settle-up open yet</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink/55">
          {detail.settleMode === "scheduled" && detail.settleAnchor
            ? `This group settles on ${detail.settleAnchor}. Payments open then.`
            : "Payments open once an admin starts a settle-up, so everyone pays at the same time."}
        </p>
        <p className="num mt-4 text-[26px] font-bold leading-none text-money-out">
          ${due.toFixed(2)}
        </p>
        <p className="mt-1 text-[11px] text-ink/45">your running balance</p>

        {detail.youAdmin && detail.settleMode !== "scheduled" ? (
          <button
            onClick={start}
            className="press mt-5 w-full rounded-[18px] bg-brand py-3 text-[12px] font-bold text-white"
          >
            Start settle-up now
          </button>
        ) : (
          <button
            onClick={request}
            disabled={sent}
            className="press mt-5 w-full rounded-[18px] bg-brand py-3 text-[12px] font-bold text-white disabled:bg-money-in"
          >
            {sent ? "Request sent to admin" : "Request settle-up"}
          </button>
        )}
      </div>
    </AppShell>
  );
}
