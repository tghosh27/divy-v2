import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Building2, Check, ShieldCheck, Users, Wallet } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AmountPad, BackHeader, BigAmount, PrimaryButton, Row, meta } from "@/components/SubScreen";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { groupWalletTransferOut } from "@/lib/divy.functions";

export const Route = createFileRoute("/_authenticated/wallet-out/$groupId")({
  loader: async ({ context, params }) => {
    const snapshot = await context.queryClient.ensureQueryData(snapshotQuery);
    const detail = snapshot.groupDetails[params.groupId];
    if (!detail || !detail.wallet) throw notFound();
    return snapshot;
  },
  head: () => meta("Transfer out", "Move money out of a shared group wallet."),
  component: WalletOutScreen,
});

function WalletOutScreen() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(snapshotQuery);
  const navigate = useNavigate();
  const refresh = useRefreshSnapshot();
  const transferOut = useServerFn(groupWalletTransferOut);

  const detail = data.groupDetails[params.groupId];
  const [amount, setAmount] = useState("0.00");
  const [pad, setPad] = useState(false);
  const [note, setNote] = useState("");
  const [dest, setDest] = useState<"wallet" | "bank">("wallet");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!detail || !detail.wallet) return null;
  const wallet = detail.wallet;
  const accounts = data.linkedAccounts;
  const num = parseFloat(amount) || 0;

  if (!detail.youAdmin) {
    return (
      <AppShell>
        <BackHeader eyebrow="Shared wallet" title={detail.name} to="/groups" />
        <div className="glass card-in mt-6 rounded-[24px] p-5 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
            <ShieldCheck className="size-5" />
          </span>
          <p className="mt-3 text-sm font-semibold">Admins only</p>
          <p className="mt-1 text-[12px] text-ink/55">
            Only a wallet admin can move money out. You can pay dues and add expenses.
          </p>
        </div>
      </AppShell>
    );
  }

  async function submit() {
    if (num <= 0 || busy) return;
    setBusy(true);
    setError(null);
    const res = await transferOut({
      data: { groupId: params.groupId, amount: num, note, destination: dest, accountId },
    });
    if (!res.ok) {
      setError(res.error ?? "That didn't go through");
      setBusy(false);
      return;
    }
    await refresh();
    setDone(true);
    setTimeout(() => navigate({ to: "/group/$groupId", params: { groupId: params.groupId } }), 900);
  }

  return (
    <AppShell>
      <BackHeader eyebrow="Transfer out" title={detail.name} to="/groups" />

      <div className="glass card-in mt-4 flex items-center gap-3 rounded-[22px] p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Users className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Group wallet</p>
          <p className="num text-[11px] text-ink/50">${wallet.available.toFixed(2)} available</p>
        </div>
      </div>

      <BigAmount
        value={amount}
        hint={pad ? "Tap to hide keypad" : "Tap to enter an amount"}
        onTap={() => setPad((v) => !v)}
      />
      {pad ? <AmountPad value={amount} onChange={setAmount} max={Math.max(1, wallet.available)} /> : null}

      <button
        onClick={() => setAmount(wallet.available.toFixed(2))}
        className="press glass mt-5 w-full rounded-2xl py-2.5 text-[12px] font-bold"
      >
        Transfer everything
      </button>

      <div className="mt-5">
        <span className="text-[11px] font-semibold text-ink/50">Send it to</span>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([
            { id: "wallet" as const, label: "My Divy wallet", icon: Wallet },
            { id: "bank" as const, label: "A bank account", icon: Building2 },
          ]).map((o) => (
            <button
              key={o.id}
              onClick={() => setDest(o.id)}
              className={`press flex items-center gap-2 rounded-[18px] px-3 py-3 text-[12px] font-bold outline-1 -outline-offset-1 transition-all ${
                dest === o.id
                  ? "bg-brand text-white outline-transparent"
                  : "bg-white/70 text-ink/70 outline-black/8"
              }`}
            >
              <o.icon className="size-4" />
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {dest === "bank" ? (
        accounts.length ? (
          <div className="glass mt-3 rounded-[22px] px-4">
            <div className="divide-y divide-black/5">
              {accounts.map((a) => {
                const picked = (accountId ?? accounts.find((x) => x.primary)?.id ?? accounts[0]?.id) === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setAccountId(a.id)}
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
                      <Building2 className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{a.name}</span>
                      <span className="block text-[11px] text-ink/50">{a.detail}</span>
                    </span>
                    {picked ? <Check className="size-4 text-brand" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-ink/55">
            No bank account linked yet — add one in Wallet, then come back.
          </p>
        )
      ) : null}

      <label className="mt-4 block">
        <span className="text-[11px] font-semibold text-ink/50">What's it for?</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Venue deposit"
          className="mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-1 -outline-offset-1 outline-black/8 focus:outline-brand"
        />
      </label>

      <div className="glass card-in mt-5 rounded-[24px] px-4 py-1.5">
        <Row label="Out of group wallet" value={`$${num.toFixed(2)}`} />
        <Row
          label={dest === "bank" ? "To your bank account" : "Into your Divy wallet"}
          value={`$${num.toFixed(2)}`}
        />
        {dest === "bank" ? <Row label="Arrives in" value="1-2 business days" /> : null}
        <Row label="Group wallet after" value={`$${(wallet.available - num).toFixed(2)}`} strong />
      </div>

      {error ? (
        <p className="mt-3 text-center text-[12px] font-semibold text-money-out">{error}</p>
      ) : null}

      <PrimaryButton disabled={num <= 0 || busy} done={done} onClick={submit}>
        {done ? "Transferred" : busy ? "Transferring…" : `Transfer $${num.toFixed(2)}`}
      </PrimaryButton>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ink/45">
        <ShieldCheck className="size-3.5" />
        Every transfer is logged in the group audit trail
      </p>
    </AppShell>
  );
}
