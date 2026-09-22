import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarDays, Globe2, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { BackHeader, meta } from "@/components/SubScreen";
import { PhotoPicker } from "@/components/PhotoPicker";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { coverOptions, coverSrc } from "@/lib/divy-assets";
import { updateGroup } from "@/lib/divy.functions";
import {
  SETTLE_FREQUENCY_LABEL,
  fmtDay,
  nextSettleDates,
  type SettleFrequency,
  type SettleMode,
} from "@/lib/divy-types";

export const Route = createFileRoute("/_authenticated/edit-group/$groupId")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () => meta("Edit group", "Change the group name, photo and settle-up window."),
  component: EditGroupScreen,
});

const CONFIRM_DAYS = [1, 2, 3, 7];

function EditGroupScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const params = Route.useParams();
  const navigate = useNavigate();
  const save = useServerFn(updateGroup);
  const refresh = useRefreshSnapshot();

  const detail = data.groupDetails[params.groupId];
  if (!detail) throw notFound();

  const [name, setName] = useState(detail.name);
  const [purpose, setPurpose] = useState(detail.purpose ?? "");
  const [coverKey, setCoverKey] = useState(detail.coverKey);
  const [mode, setMode] = useState<SettleMode>(detail.settleMode);
  const [freq, setFreq] = useState<SettleFrequency>(detail.settleFrequency ?? "monthly");
  const [anchor, setAnchor] = useState(detail.settleAnchor ?? "");
  const [confirmDays, setConfirmDays] = useState(detail.confirmDays);
  const [multi, setMulti] = useState(detail.multicurrency);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!detail.youAdmin) {
    return (
      <AppShell>
        <BackHeader eyebrow={detail.name} title="Edit group" to={`/group/${params.groupId}`} />
        <div className="glass card-in mt-5 rounded-[24px] p-5 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
            <ShieldCheck className="size-5" />
          </span>
          <p className="mt-3 text-sm font-semibold">Admins only</p>
          <p className="mt-1 text-[12px] text-ink/55">
            Ask a group admin to change the name, photo or settle-up dates.
          </p>
        </div>
      </AppShell>
    );
  }

  const upcoming = mode === "scheduled" && anchor ? nextSettleDates(anchor, freq, 3) : [];

  async function handleSave() {
    if (busy) return;
    if (!name.trim()) return setError("Give the group a name");
    if (mode === "scheduled" && !anchor) return setError("Pick the first settle-up date");
    setBusy(true);
    setError(null);
    const res = await save({
      data: {
        groupId: params.groupId,
        name,
        purpose: purpose.trim() ? purpose : null,
        coverKey,
        settleMode: mode,
        settleFrequency: mode === "scheduled" ? freq : null,
        settleAnchor: mode === "scheduled" ? anchor : null,
        confirmDays,
        multicurrency: multi,
      },
    });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Could not save those changes");
    await refresh();
    navigate({ to: "/group/$groupId", params: { groupId: params.groupId } });
  }

  return (
    <AppShell>
      <BackHeader
        eyebrow={detail.name}
        title="Edit group"
        to={`/group/${params.groupId}`}
      />

      <div className="glass card-in mt-5 rounded-[24px] p-4">
        <label className="block text-[11px] font-semibold text-ink/50">Group name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold outline-1 -outline-offset-1 outline-black/8 focus:outline-brand"
        />
        <label className="mt-3 block text-[11px] font-semibold text-ink/50">
          What it's for (optional)
        </label>
        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Ski trip, rent and utilities, dues…"
          className="mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-1 -outline-offset-1 outline-black/8 focus:outline-brand"
        />
        <div className="mt-4">
          <PhotoPicker
            label="Group photo"
            value={coverKey}
            onChange={setCoverKey}
            options={coverOptions}
            srcFor={coverSrc}
            hint="Take one, pick from your photos, or use a default."
          />
        </div>
      </div>

      <div className="glass card-in mt-4 rounded-[24px] p-4" style={{ animationDelay: "0.05s" }}>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarDays className="size-4 text-brand" /> Settle-up window
        </p>
        <div className="mt-3 flex gap-1.5">
          {(["anytime", "scheduled"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`press flex-1 rounded-full py-2.5 text-[11px] font-bold ${
                mode === m
                  ? "bg-brand text-white"
                  : "bg-white/70 text-ink/60 outline-1 -outline-offset-1 outline-black/8"
              }`}
            >
              {m === "anytime" ? "Anytime" : "On a schedule"}
            </button>
          ))}
        </div>

        {mode === "anytime" ? (
          <p className="mt-2 text-[11px] text-ink/50">
            Anyone can pay what they owe whenever they want.
          </p>
        ) : (
          <>
            <label className="mt-3 block text-[11px] font-semibold text-ink/50">Repeats</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(["weekly", "biweekly", "monthly"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFreq(f)}
                  className={`press rounded-full px-3 py-2 text-[11px] font-bold ${
                    freq === f
                      ? "bg-brand text-white"
                      : "bg-white/70 text-ink/60 outline-1 -outline-offset-1 outline-black/8"
                  }`}
                >
                  {SETTLE_FREQUENCY_LABEL[f]}
                </button>
              ))}
            </div>

            <label className="mt-3 block text-[11px] font-semibold text-ink/50">
              Next settle-up date
            </label>
            <input
              type="date"
              value={anchor}
              onChange={(e) => setAnchor(e.target.value)}
              className="num mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold outline-1 -outline-offset-1 outline-black/8 focus:outline-brand"
            />

            <label className="mt-3 block text-[11px] font-semibold text-ink/50">
              Days to confirm before paying
            </label>
            <div className="mt-1 flex gap-1.5">
              {CONFIRM_DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => setConfirmDays(d)}
                  className={`press flex-1 rounded-full py-2 text-[11px] font-bold ${
                    confirmDays === d
                      ? "bg-brand text-white"
                      : "bg-white/70 text-ink/60 outline-1 -outline-offset-1 outline-black/8"
                  }`}
                >
                  {d} {d === 1 ? "day" : "days"}
                </button>
              ))}
            </div>

            {upcoming.length ? (
              <p className="mt-3 text-[11px] text-ink/50">
                Coming up: {upcoming.map((d) => fmtDay(d)).join(" · ")}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="glass card-in mt-4 rounded-[24px] p-4" style={{ animationDelay: "0.08s" }}>
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
            <Globe2 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">Other currencies</p>
            <p className="text-[11px] text-ink/50">Converted to USD when you settle up.</p>
          </div>
          <button
            onClick={() => setMulti((v) => !v)}
            aria-label="Toggle other currencies"
            className={`press h-6 w-10 shrink-0 rounded-full transition-colors ${
              multi ? "bg-brand" : "bg-ink/15"
            }`}
          >
            <span
              className={`block size-5 rounded-full bg-white transition-transform ${
                multi ? "translate-x-[18px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-center text-[12px] font-semibold text-money-out">{error}</p>
      ) : null}

      <button
        onClick={handleSave}
        disabled={busy}
        className="press mt-4 w-full rounded-[20px] bg-brand py-3.5 text-[13px] font-bold text-white"
      >
        {busy ? "Saving…" : "Save changes"}
      </button>
    </AppShell>
  );
}
