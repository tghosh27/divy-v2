import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AmountPad, BackHeader, BigAmount, PrimaryButton, meta } from "@/components/SubScreen";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { walletSend } from "@/lib/divy.functions";
import { avatarSrc } from "@/lib/divy-assets";

export const Route = createFileRoute("/_authenticated/wallet-send")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () => meta("Send money", "Send money straight from your Divy wallet to anyone in your groups."),
  component: SendScreen,
});

function SendScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const navigate = useNavigate();
  const refresh = useRefreshSnapshot();
  const doSend = useServerFn(walletSend);

  const [query, setQuery] = useState("");
  const [personId, setPersonId] = useState<string | null>(null);
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const num = parseFloat(amount) || 0;
  const person = data.people.find((p) => p.id === personId);
  const results = data.people.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.handle.toLowerCase().includes(query.toLowerCase()),
  );

  async function submit() {
    if (!person || num <= 0 || busy) return;
    setBusy(true);
    await doSend({ data: { name: person.name, amount: num, note } });
    await refresh();
    setDone(true);
    setTimeout(() => navigate({ to: "/wallet" }), 1100);
  }

  return (
    <AppShell>
      <BackHeader eyebrow="Divy wallet" title="Send money" to="/wallet" />

      {person ? (
        <>
          <div className="glass card-in mt-5 flex items-center gap-3 rounded-[22px] p-3.5">
            <img src={avatarSrc(person.avatarKey)} alt={person.name} className="size-11 rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{person.name}</p>
              <p className="text-[11px] text-ink/50">{person.handle}</p>
            </div>
            <button
              onClick={() => setPersonId(null)}
              className="press rounded-full bg-white/70 px-3 py-1.5 text-[11px] font-bold text-ink/65 outline-1 -outline-offset-1 outline-black/8"
            >
              Change
            </button>
          </div>

          <BigAmount value={amount} hint={`Wallet balance $${data.wallet.available.toFixed(2)}`} />
          <AmountPad value={amount} onChange={setAmount} max={data.wallet.available} />

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What's it for?"
            className="glass mt-4 w-full rounded-[20px] px-4 py-3.5 text-sm font-medium text-ink placeholder:text-ink/35 focus:outline-brand/40"
          />

          <PrimaryButton onClick={submit} disabled={(num <= 0 || busy) && !done} done={done}>
            {done
              ? "Sent ✓"
              : busy
                ? "Sending…"
                : num > 0
                  ? `Send $${num.toFixed(2)} to ${person.name.split(" ")[0]}`
                  : "Enter an amount"}
          </PrimaryButton>
        </>
      ) : (
        <>
          <div className="glass card-in mt-5 flex items-center gap-2.5 rounded-[20px] px-4 py-3.5">
            <Search className="size-4 shrink-0 text-ink/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or @handle"
              className="w-full bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink/35"
            />
          </div>

          <p className="mt-6 px-1 text-[10px] font-semibold uppercase tracking-normal text-ink/45">
            {query ? "Results" : "Frequent"}
          </p>
          <div className="glass card-in mt-2 rounded-[24px] px-4">
            {results.length ? (
              <div className="divide-y divide-black/5">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPersonId(p.id)}
                    className="press flex w-full items-center gap-3 py-3.5 text-left"
                  >
                    <img src={avatarSrc(p.avatarKey)} alt={p.name} className="size-9 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="text-[11px] text-ink/50">{p.handle}</p>
                    </div>
                    <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-bold text-brand">
                      Send
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-[13px] text-ink/50">No one matches "{query}"</p>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
