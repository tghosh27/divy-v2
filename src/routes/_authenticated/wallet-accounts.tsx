import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CreditCard, Landmark, Plus, ShieldCheck, Star, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { BackHeader, meta } from "@/components/SubScreen";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { addLinkedAccount, removeLinkedAccount, setPrimaryAccount } from "@/lib/divy.functions";

export const Route = createFileRoute("/_authenticated/wallet-accounts")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () => meta("Payment accounts", "Manage the bank accounts and cards linked to your Divy wallet."),
  component: AccountsScreen,
});

function AccountsScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const refresh = useRefreshSnapshot();
  const doAdd = useServerFn(addLinkedAccount);
  const doPrimary = useServerFn(setPrimaryAccount);
  const doRemove = useServerFn(removeLinkedAccount);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [kind, setKind] = useState<"bank" | "card">("bank");
  const [busy, setBusy] = useState(false);

  async function addAccount() {
    if (!name.trim() || busy) return;
    setBusy(true);
    await doAdd({ data: { name: name.trim(), detail: detail.trim(), kind } });
    await refresh();
    setName("");
    setDetail("");
    setKind("bank");
    setShowForm(false);
    setBusy(false);
  }

  async function makeDefault(accountId: string) {
    await doPrimary({ data: { accountId } });
    await refresh();
  }

  async function remove(accountId: string) {
    await doRemove({ data: { accountId } });
    await refresh();
  }

  return (
    <AppShell>
      <BackHeader eyebrow="Divy wallet" title="Accounts" to="/wallet" />

      <div className="glass card-in mt-5 rounded-[24px] px-4">
        <p className="py-3.5 text-sm font-semibold">Linked accounts</p>
        {data.linkedAccounts.length === 0 ? (
          <p className="border-t border-black/5 py-8 text-center text-[13px] text-ink/50">
            No accounts linked yet. Add one below.
          </p>
        ) : (
          <div className="divide-y divide-black/5 border-t border-black/5">
            {data.linkedAccounts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  {a.kind === "bank" ? <Landmark className="size-4" /> : <CreditCard className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.name}</p>
                  <p className="text-[11px] text-ink/50">
                    {a.detail} · {a.kind === "bank" ? "Bank account" : "Card"}
                  </p>
                </div>
                {a.primary ? (
                  <span className="flex items-center gap-1 rounded-full bg-money-in/12 px-2 py-0.5 text-[10px] font-bold text-money-in">
                    <Star className="size-2.5" /> Default
                  </span>
                ) : (
                  <button
                    onClick={() => makeDefault(a.id)}
                    className="press rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold text-ink/65 outline-1 -outline-offset-1 outline-black/8"
                  >
                    Make default
                  </button>
                )}
                <button
                  onClick={() => remove(a.id)}
                  aria-label="Remove account"
                  className="press ml-1 grid size-7 shrink-0 place-items-center rounded-full text-ink/40 hover:text-money-out"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <div className="space-y-2 border-t border-black/5 py-3.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Account name"
              className="w-full rounded-2xl bg-white/60 px-3.5 py-2.5 text-sm font-semibold outline-1 -outline-offset-1 outline-black/5 placeholder:font-normal placeholder:text-ink/35 focus:outline-brand"
            />
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="•••• 1234"
              className="w-full rounded-2xl bg-white/60 px-3.5 py-2.5 text-sm font-semibold outline-1 -outline-offset-1 outline-black/5 placeholder:font-normal placeholder:text-ink/35 focus:outline-brand"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setKind("bank")}
                className={`press flex-1 rounded-full py-2 text-[12px] font-bold ${
                  kind === "bank" ? "bg-brand text-white" : "glass text-ink/65"
                }`}
              >
                Bank
              </button>
              <button
                onClick={() => setKind("card")}
                className={`press flex-1 rounded-full py-2 text-[12px] font-bold ${
                  kind === "card" ? "bg-brand text-white" : "glass text-ink/65"
                }`}
              >
                Card
              </button>
            </div>
            <button
              onClick={addAccount}
              disabled={!name.trim() || busy}
              className="press w-full rounded-2xl bg-brand py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
            >
              {busy ? "Adding…" : "Save account"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="press flex w-full items-center justify-center gap-1.5 border-t border-black/5 py-3.5 text-xs font-bold text-brand"
          >
            <Plus className="size-3.5" /> Link a new account
          </button>
        )}
      </div>

      <div className="glass card-in mt-4 flex items-start gap-3 rounded-[22px] p-4" style={{ animationDelay: "0.06s" }}>
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-money-in" />
        <p className="text-[12px] leading-relaxed text-ink/60">
          Accounts are verified through your bank and never shared with the people in your groups.
          Divy only sees the last four digits.
        </p>
      </div>

      <div className="glass card-in mt-4 rounded-[22px] px-4" style={{ animationDelay: "0.12s" }}>
        {[
          { label: "Auto top-up wallet", value: "Off" },
          { label: "Auto settle overdue cycles", value: "On" },
          { label: "Default payout speed", value: "Standard" },
        ].map((r, i, arr) => (
          <div
            key={r.label}
            className={`flex items-center justify-between py-3.5 ${
              i < arr.length - 1 ? "border-b border-black/5" : ""
            }`}
          >
            <span className="text-[13px] font-medium text-ink/70">{r.label}</span>
            <span className="text-[12px] font-bold text-brand">{r.value}</span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
