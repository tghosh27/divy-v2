import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarDays, Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AmountPad, BackHeader, BigAmount, PrimaryButton, Row, meta } from "@/components/SubScreen";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { createFundingRequest } from "@/lib/divy.functions";

export const Route = createFileRoute("/_authenticated/funding-new/$groupId")({
  loader: async ({ context, params }) => {
    const snapshot = await context.queryClient.ensureQueryData(snapshotQuery);
    const detail = snapshot.groupDetails[params.groupId];
    if (!detail || !detail.wallet) throw notFound();
    return snapshot;
  },
  head: () => meta("New funding request", "Ask group members to pay toward a shared goal."),
  component: NewFundingRequest,
});

const AUDIENCES = ["All members", "Non-admins", "New members"] as const;
const DUE_OPTIONS = [
  { label: "In 7 days", days: 7 },
  { label: "In 14 days", days: 14 },
  { label: "In 30 days", days: 30 },
  { label: "End of term", days: 60 },
] as const;

function NewFundingRequest() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(snapshotQuery);
  const navigate = useNavigate();
  const refresh = useRefreshSnapshot();
  const doCreate = useServerFn(createFundingRequest);

  const detail = data.groupDetails[params.groupId];
  if (!detail || !detail.wallet) return null;

  const [amount, setAmount] = useState("0");
  const [pad, setPad] = useState(false);
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState<string>(AUDIENCES[0]);
  const [due, setDue] = useState<(typeof DUE_OPTIONS)[number]>(DUE_OPTIONS[1]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = parseFloat(amount) || 0;
  const payers = audience === "All members" ? detail.members.length : Math.max(1, detail.members.length - 1);

  async function submit() {
    if (num <= 0 || title.trim() === "" || busy) return;
    setBusy(true);
    const res = await doCreate({
      data: { groupId: params.groupId, title: title.trim(), amount: num, audience, dueInDays: due.days },
    });
    if (!res.ok) {
      setError(res.error ?? "That didn't go through");
      setBusy(false);
      return;
    }
    setError(null);
    await refresh();
    setDone(true);
    setTimeout(() => navigate({ to: "/group/$groupId", params: { groupId: params.groupId } }), 900);
  }

  return (
    <AppShell>
      <BackHeader eyebrow="Funding request" title={detail.name} to="/groups" />

      <BigAmount
        value={amount}
        hint={pad ? "Tap to hide keypad" : "Per member · tap to enter"}
        onTap={() => setPad((v) => !v)}
      />
      {pad ? <AmountPad value={amount} onChange={setAmount} max={10000} /> : null}

      <div className="glass card-in mt-5 rounded-[24px] p-4">
        <label className="block text-[10px] font-semibold uppercase tracking-normal text-ink/45">
          What is it for?
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Spring formal deposit"
          className="mt-2 w-full rounded-2xl bg-white/60 px-3.5 py-3 text-sm font-semibold outline-1 -outline-offset-1 outline-black/5 placeholder:font-normal placeholder:text-ink/35 focus:outline-brand"
        />
      </div>

      <p className="mt-5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-normal text-ink/45">
        <Users className="size-3" /> Who pays
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {AUDIENCES.map((a) => (
          <button
            key={a}
            onClick={() => setAudience(a)}
            className={`press rounded-full px-3.5 py-2 text-[12px] font-bold ${
              audience === a ? "bg-brand text-white" : "glass text-ink/65"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <p className="mt-5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-normal text-ink/45">
        <CalendarDays className="size-3" /> Due
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {DUE_OPTIONS.map((d) => (
          <button
            key={d.label}
            onClick={() => setDue(d)}
            className={`press rounded-full px-3.5 py-2 text-[12px] font-bold ${
              due.label === d.label ? "bg-brand text-white" : "glass text-ink/65"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="glass card-in mt-5 rounded-[24px] px-4 py-1.5">
        <Row label="Per member" value={`$${num.toFixed(2)}`} />
        <Row label="Members asked" value={`${payers}`} />
        <Row label="Due" value={due.label} />
        <Row label="Goal total" value={`$${(num * payers).toFixed(2)}`} strong />
      </div>

      {error ? (
        <p className="mt-3 text-center text-[12px] font-semibold text-money-out">{error}</p>
      ) : null}

      <PrimaryButton
        disabled={num <= 0 || title.trim() === "" || busy}
        done={done}
        onClick={submit}
      >
        {done ? "Request sent to members" : busy ? "Sending…" : `Request $${num.toFixed(2)} each`}
      </PrimaryButton>

      <p className="mt-3 text-center text-[11px] text-ink/45">
        Members get a reminder when the due date approaches
      </p>
    </AppShell>
  );
}
