import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Landmark, ShieldCheck, Users, Wallet } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AmountPad, BackHeader, BigAmount, PrimaryButton, Row, meta } from "@/components/SubScreen";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { settleGroup } from "@/lib/divy.functions";

export const Route = createFileRoute("/_authenticated/contribute/$groupId")({
  loader: async ({ context, params }) => {
    const snapshot = await context.queryClient.ensureQueryData(snapshotQuery);
    const detail = snapshot.groupDetails[params.groupId];
    if (!detail || !detail.wallet) throw notFound();
    return snapshot;
  },
  validateSearch: (search: Record<string, unknown>): { requestId?: string } =>
    typeof search['requestId'] === "string" ? { requestId: search['requestId'] } : {},
  head: () => meta("Pay", "Send money into your shared wallet."),
  component: ContributeScreen,
});

function ContributeScreen() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(snapshotQuery);
  const navigate = useNavigate();
  const refresh = useRefreshSnapshot();
  const doSettle = useServerFn(settleGroup);

  const detail = data.groupDetails[params.groupId];
  if (!detail || !detail.wallet) return null;
  const wallet = detail.wallet;

  const [amount, setAmount] = useState(wallet.yourDues.toFixed(2));
  const [pad, setPad] = useState(false);
  const [source, setSource] = useState("wallet");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const num = parseFloat(amount) || 0;
  const search = Route.useSearch();
  const request =
    wallet.fundingRequests.find((r) => r.id === search.requestId) ?? wallet.fundingRequests[0];
  const instant = source === "wallet";

  const sources = [
    {
      id: "wallet",
      name: "Divy wallet",
      detail: `$${data.wallet.available.toFixed(2)} available · instant`,
      icon: Wallet,
    },
    ...data.linkedAccounts.map((a) => ({
      id: a.id,
      name: a.name,
      detail: `${a.detail} · 1–2 business days`,
      icon: Landmark,
    })),
  ];

  async function submit() {
    if (num <= 0 || busy) return;
    setBusy(true);
    const sourceName = sources.find((s) => s.id === source)?.name ?? "Divy wallet";
    await doSettle({
      data: {
        groupId: params.groupId,
        amount: num,
        source: sourceName,
        kind: "dues",
        requestId: request?.id ?? null,
      },
    });
    await refresh();
    setDone(true);
    setTimeout(() => navigate({ to: "/group/$groupId", params: { groupId: params.groupId } }), 900);
  }

  return (
    <AppShell>
      <BackHeader eyebrow="Pay" title={detail.name} to="/groups" />

      <div className="glass card-in mt-4 flex items-center gap-3 rounded-[22px] p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Users className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{request?.title ?? "Group dues"}</p>
          <p className="text-[11px] text-ink/50">
            {request ? `Due ${request.due} · ${request.audience}` : detail.purpose ?? "Shared wallet"}
          </p>
        </div>
      </div>

      <BigAmount
        value={amount}
        hint={
          pad
            ? "Tap to hide keypad"
            : `Your dues · $${wallet.yourDues.toFixed(2)} — tap to edit`
        }
        onTap={() => setPad((v) => !v)}
      />
      {pad ? <AmountPad value={amount} onChange={setAmount} max={5000} /> : null}

      <div className="mt-5 flex gap-2">
        <button
          onClick={() => setAmount(wallet.yourDues.toFixed(2))}
          className="press glass flex-1 rounded-2xl py-2.5 text-[12px] font-bold"
        >
          Pay in full
        </button>
        <button
          onClick={() => setAmount((wallet.yourDues / 2).toFixed(2))}
          className="press glass flex-1 rounded-2xl py-2.5 text-[12px] font-bold"
        >
          Pay half
        </button>
      </div>

      <p className="mt-6 px-1 text-[10px] font-semibold uppercase tracking-normal text-ink/45">
        Pay from
      </p>
      <div className="mt-2 space-y-2">
        {sources.map((s) => (
          <button
            key={s.id}
            onClick={() => setSource(s.id)}
            className="press glass flex w-full items-center gap-3 rounded-[20px] p-3 text-left"
          >
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                source === s.id ? "bg-brand text-white" : "bg-white/70 text-brand"
              }`}
            >
              <s.icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{s.name}</span>
              <span className="block truncate text-[11px] text-ink/50">{s.detail}</span>
            </span>
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full ${
                source === s.id ? "bg-brand text-white" : "outline-1 -outline-offset-1 outline-black/15"
              }`}
            >
              {source === s.id ? <Check className="size-3" /> : null}
            </span>
          </button>
        ))}
      </div>

      <div className="glass card-in mt-5 rounded-[24px] px-4 py-1.5">
        <Row label="Dues" value={`$${num.toFixed(2)}`} />
        <Row label="Arrives" value={instant ? "Instantly" : "1–2 business days"} />
        <Row
          label="Wallet after"
          value={`$${(wallet.available + num).toFixed(2)}`}
          strong
        />
      </div>

      <PrimaryButton
        disabled={num <= 0 || busy}
        done={done}
        onClick={submit}
      >
        {done ? "Payment sent" : busy ? "Sending…" : `Pay $${num.toFixed(2)}`}
      </PrimaryButton>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ink/45">
        <ShieldCheck className="size-3.5" />
        Every deposit is logged in the group audit trail
      </p>
    </AppShell>
  );
}
