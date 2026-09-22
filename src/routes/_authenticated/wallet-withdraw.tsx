import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Landmark, Plus, Zap } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AmountPad, BackHeader, BigAmount, PrimaryButton, meta } from "@/components/SubScreen";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { walletTransfer } from "@/lib/divy.functions";

export const Route = createFileRoute("/_authenticated/wallet-withdraw")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () => meta("Withdraw", "Cash out your Divy wallet balance to a linked bank account."),
  component: WithdrawScreen,
});

function WithdrawScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const navigate = useNavigate();
  const refresh = useRefreshSnapshot();
  const doTransfer = useServerFn(walletTransfer);

  const banks = data.linkedAccounts.filter((a) => a.kind === "bank");

  const [amount, setAmount] = useState("0");
  const [padOpen, setPadOpen] = useState(true);
  const [account, setAccount] = useState(banks[0]?.id ?? "");
  const [instant, setInstant] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const num = parseFloat(amount) || 0;
  const fee = instant ? Math.round(num * 0.015 * 100) / 100 : 0;
  const selected = banks.find((a) => a.id === account);

  async function submit() {
    if (num <= 0 || busy) return;
    setBusy(true);
    await doTransfer({
      data: {
        direction: "withdraw",
        amount: num,
        accountName: selected?.name ?? "Bank account",
        instant,
        fee,
      },
    });
    await refresh();
    setDone(true);
    setTimeout(() => navigate({ to: "/wallet" }), 1100);
  }

  return (
    <AppShell>
      <BackHeader eyebrow="Divy wallet" title="Withdraw" to="/wallet" />

      <BigAmount
        value={amount}
        hint={`Available $${data.wallet.available.toFixed(2)} · tap to ${padOpen ? "hide" : "edit"}`}
        onTap={() => setPadOpen((v) => !v)}
      />

      <button
        onClick={() => setAmount(data.wallet.available.toFixed(2))}
        className={`press mt-3 w-full rounded-full py-2 text-[12px] font-bold ${
          num === data.wallet.available ? "bg-brand text-white" : "glass text-ink/65"
        }`}
      >
        Withdraw everything · ${data.wallet.available.toFixed(2)}
      </button>

      {padOpen ? (
        <AmountPad value={amount} onChange={setAmount} max={data.wallet.available} />
      ) : null}

      <p className="mt-6 px-1 text-[10px] font-semibold uppercase tracking-normal text-ink/45">
        To
      </p>
      {banks.length === 0 ? (
        <Link
          to="/wallet-accounts"
          className="glass card-in mt-2 flex items-center gap-3 rounded-[20px] p-3.5 text-left"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <Plus className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">Link a bank account</p>
            <p className="text-[11px] text-ink/50">No bank accounts linked yet</p>
          </div>
        </Link>
      ) : (
        <div className="mt-2 space-y-2">
          {banks.map((a) => (
            <button
              key={a.id}
              onClick={() => setAccount(a.id)}
              className={`press glass flex w-full items-center gap-3 rounded-[20px] p-3.5 text-left ${
                account === a.id ? "shadow-[0_14px_32px_-14px_rgba(124,58,237,0.55)]" : ""
              }`}
            >
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                  account === a.id ? "bg-brand text-white" : "bg-brand-soft text-brand"
                }`}
              >
                <Landmark className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{a.name}</p>
                <p className="text-[11px] text-ink/50">{a.detail}</p>
              </div>
              {account === a.id ? (
                <span className="grid size-5 place-items-center rounded-full bg-brand text-white">
                  <Check className="size-3" />
                </span>
              ) : (
                <span className="size-5 rounded-full outline-1 -outline-offset-1 outline-black/12" />
              )}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setInstant((v) => !v)}
        className="press glass mt-4 flex w-full items-center gap-3 rounded-[20px] p-3.5 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Zap className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">Instant cash out</p>
          <p className="text-[11px] text-ink/50">
            {instant ? "Arrives in minutes · 1.5% fee" : "Free · arrives in 1–3 business days"}
          </p>
        </div>
        <span
          className={`relative h-6 w-10 rounded-full transition-colors ${
            instant ? "bg-brand" : "bg-ink/15"
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${
              instant ? "left-[18px]" : "left-0.5"
            }`}
          />
        </span>
      </button>

      <div className="glass card-in mt-4 rounded-[22px] p-4">
        <div className="divide-y divide-black/5">
          <SumRow label="Withdrawing" value={`$${num.toFixed(2)}`} />
          <SumRow label="Fee" value={`$${fee.toFixed(2)}`} />
          <SumRow label="You'll receive" value={`$${Math.max(num - fee, 0).toFixed(2)}`} />
          <SumRow
            label="Wallet left"
            value={`$${Math.max(data.wallet.available - num, 0).toFixed(2)}`}
          />
        </div>
      </div>

      <PrimaryButton onClick={submit} disabled={(num <= 0 || !selected) && !done} done={done}>
        {done ? "Withdrawal started ✓" : busy ? "Processing…" : num > 0 ? `Withdraw $${num.toFixed(2)}` : "Enter an amount"}
      </PrimaryButton>
    </AppShell>
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
