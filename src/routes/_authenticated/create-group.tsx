import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BookUser,
  CalendarDays,
  Check,
  ChevronDown,
  Globe,
  ImagePlus,
  Loader2,
  MessageSquare,
  Plus,
  QrCode,
  X,
} from "lucide-react";
import { useState } from "react";

import { BackHeader, PrimaryButton, meta } from "@/components/SubScreen";
import { QrScanner } from "@/components/QrScanner";
import { coverOptions, coverSrc } from "@/lib/divy-assets";
import { PhotoPicker } from "@/components/PhotoPicker";
import { useRefreshSnapshot } from "@/lib/divy-client";
import { createGroup, joinGroup } from "@/lib/divy.functions";
import type { GroupKind, SettleFrequency } from "@/lib/divy-types";
import { SETTLE_FREQUENCY_LABEL, addDays, fmtDay, isoDay, nextSettleDates } from "@/lib/divy-types";

export const Route = createFileRoute("/_authenticated/create-group")({
  head: () => meta("New group", "Start a split group or a shared wallet, or join an existing group with a code."),
  component: CreateGroupScreen,
});

const CONFIRM_OPTIONS = [1, 2, 3, 7];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press rounded-full px-3.5 py-2 text-[12px] font-bold ${
        active ? "bg-brand text-white" : "bg-white/70 text-ink/60 outline-1 -outline-offset-1 outline-black/8"
      }`}
    >
      {children}
    </button>
  );
}

function Disclosure({
  icon,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="glass card-in mt-3 rounded-[24px]">
      <button
        type="button"
        onClick={onToggle}
        className="press flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold">{title}</span>
          <span className="block truncate text-[11px] text-ink/50">{summary}</span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-ink/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="border-t border-black/5 px-4 py-4">{children}</div> : null}
    </div>
  );
}

function CreateGroupScreen() {
  const navigate = useNavigate();
  const refresh = useRefreshSnapshot();

  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GroupKind>("split");
  const [coverKey, setCoverKey] = useState<string>("default");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [inviteNote, setInviteNote] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // optional settings, collapsed by default
  const [openPanel, setOpenPanel] = useState<"schedule" | "currency" | null>(null);
  const [scheduled, setScheduled] = useState(false);
  const [frequency, setFrequency] = useState<SettleFrequency>("monthly");
  const [anchor, setAnchor] = useState(() => isoDay(new Date(Date.now() + 14 * 86_400_000)));
  const [confirmDays, setConfirmDays] = useState(1);
  const [multicurrency, setMulticurrency] = useState(false);

  const payBy = anchor ? addDays(anchor, confirmDays) : "";

  function addMember() {
    const value = draft.trim();
    if (!value) return;
    setMembers((prev) => [...prev, value]);
    setDraft("");
  }

  async function pickContacts() {
    setInviteNote(null);
    const nav = navigator as Navigator & {
      contacts?: {
        select: (props: string[], opts?: { multiple?: boolean }) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
      };
    };
    if (!nav.contacts?.select) {
      setInviteNote("Your phone won't share contacts with the browser here. Type names, or send a text invite.");
      return;
    }
    try {
      const picked = await nav.contacts.select(["name", "tel"], { multiple: true });
      const names = picked
        .map((c) => c.name?.[0]?.trim() || c.tel?.[0]?.trim() || "")
        .filter((n) => n.length > 0);
      if (!names.length) return;
      setMembers((prev) => [...prev, ...names.filter((n) => !prev.includes(n))]);
    } catch {
      setInviteNote("Contacts weren't shared. You can still type names or text an invite.");
    }
  }

  async function textInvite() {
    setInviteNote(null);
    const label = name.trim() || "my group";
    const body = `Join ${label} on Divy It Up so we can split expenses: https://www.divyitup.com`;
    const shareable = navigator as Navigator & { share?: (data: { text: string }) => Promise<void> };
    if (shareable.share) {
      try {
        await shareable.share({ text: body });
        return;
      } catch {
        // fall through to the SMS link
      }
    }
    window.location.href = `sms:?&body=${encodeURIComponent(body)}`;
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (tab === "create") {
        const res = await createGroup({
          data: {
            name,
            kind,
            coverKey,
            memberNames: members,
            settleMode: scheduled ? "scheduled" : "anytime",
            ...(scheduled ? { settleFrequency: frequency, settleAnchor: anchor, confirmDays } : {}),
            multicurrency,
          },
        });
        await refresh();
        setDone(true);
        setTimeout(() => navigate({ to: "/group/$groupId", params: { groupId: res.groupId } }), 700);
      } else {
        const res = await joinGroup({ data: { code } });
        if (!res.ok) {
          setError(res.error);
          setBusy(false);
          return;
        }
        await refresh();
        setDone(true);
        setTimeout(() => navigate({ to: "/group/$groupId", params: { groupId: res.groupId } }), 700);
      }
    } catch {
      setError("Couldn't save that. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="app-backdrop relative min-h-screen w-full overflow-x-hidden font-sans text-ink">
      <main className="relative mx-auto max-w-[430px] px-5 pt-6 pb-20">
        <BackHeader eyebrow="Groups" title="New group" to="/groups" />

        <div className="glass card-in mt-5 flex gap-1 rounded-full p-1">
          {(["create", "join"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`press flex-1 rounded-full py-2 text-[12px] font-bold ${
                tab === t ? "bg-brand text-white" : "text-ink/55"
              }`}
            >
              {t === "create" ? "Create" : "Join with code"}
            </button>
          ))}
        </div>

        {tab === "create" ? (
          <>
            <div className="glass card-in mt-4 space-y-4 rounded-[26px] p-5">
              <label className="block">
                <span className="text-[11px] font-semibold text-ink/50">Group name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Apartment 4B"
                  className="mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-1 -outline-offset-1 outline-black/8 placeholder:text-ink/30 focus:outline-brand"
                />
              </label>

              <div className="flex gap-2">
                {(["split", "wallet"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={`press flex-1 rounded-2xl py-2.5 text-xs font-bold ${
                      kind === k
                        ? "bg-brand text-white"
                        : "bg-white/70 text-ink/60 outline-1 -outline-offset-1 outline-black/8"
                    }`}
                  >
                    {k === "split" ? "Split expenses" : "Shared wallet"}
                  </button>
                ))}
              </div>

              <PhotoPicker
                label="Cover"
                value={coverKey}
                onChange={setCoverKey}
                options={coverOptions}
                srcFor={coverSrc}
                defaultKey="default"
                hint="Using the default group cover."
              />

              <div>
                <span className="text-[11px] font-semibold text-ink/50">Invite people (optional)</span>
                <div className="mt-2 flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addMember();
                      }
                    }}
                    placeholder="Add a name"
                    className="flex-1 rounded-2xl bg-white/70 px-4 py-3 text-sm outline-1 -outline-offset-1 outline-black/8 placeholder:text-ink/30 focus:outline-brand"
                  />
                  <button
                    onClick={addMember}
                    aria-label="Add member"
                    className="press grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={pickContacts}
                    className="press flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/70 py-2.5 text-[12px] font-bold text-ink/70 outline-1 -outline-offset-1 outline-black/8"
                  >
                    <BookUser className="size-4 text-brand" />
                    From contacts
                  </button>
                  <button
                    type="button"
                    onClick={textInvite}
                    className="press flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/70 py-2.5 text-[12px] font-bold text-ink/70 outline-1 -outline-offset-1 outline-black/8"
                  >
                    <MessageSquare className="size-4 text-brand" />
                    Text invite
                  </button>
                </div>
                {inviteNote ? <p className="mt-2 text-[11px] text-ink/45">{inviteNote}</p> : null}
                {members.length ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {members.map((m, i) => (
                      <span
                        key={`${m}-${i}`}
                        className="flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-[11px] font-semibold outline-1 -outline-offset-1 outline-black/8"
                      >
                        {m}
                        <button
                          onClick={() => setMembers((prev) => prev.filter((_, k) => k !== i))}
                          aria-label={`Remove ${m}`}
                          className="text-ink/40"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-ink/45">
                    Skip this — anyone can join later with your group code.
                  </p>
                )}
              </div>
            </div>

            <Disclosure
              icon={<CalendarDays className="size-4" />}
              title="Settle-up window"
              summary={
                scheduled
                  ? `${SETTLE_FREQUENCY_LABEL[frequency]} · first ${fmtDay(anchor)}`
                  : "Settle whenever you want"
              }
              open={openPanel === "schedule"}
              onToggle={() => setOpenPanel(openPanel === "schedule" ? null : "schedule")}
            >
              <div className="flex gap-2">
                <Chip active={!scheduled} onClick={() => setScheduled(false)}>
                  Anytime
                </Chip>
                <Chip active={scheduled} onClick={() => setScheduled(true)}>
                  On a schedule
                </Chip>
              </div>

              {scheduled ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <span className="text-[11px] font-semibold text-ink/50">Repeats</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["weekly", "biweekly", "monthly"] as const).map((f) => (
                        <Chip key={f} active={frequency === f} onClick={() => setFrequency(f)}>
                          {SETTLE_FREQUENCY_LABEL[f]}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-[11px] font-semibold text-ink/50">First settle-up date</span>
                    <input
                      type="date"
                      value={anchor}
                      onChange={(e) => setAnchor(e.target.value)}
                      className="num mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-1 -outline-offset-1 outline-black/8 focus:outline-brand"
                    />
                  </label>

                  <div>
                    <span className="text-[11px] font-semibold text-ink/50">Days to confirm before paying</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {CONFIRM_OPTIONS.map((d) => (
                        <Chip key={d} active={confirmDays === d} onClick={() => setConfirmDays(d)}>
                          {d === 7 ? "1 week" : `${d} day${d === 1 ? "" : "s"}`}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/60 p-3.5 outline-1 -outline-offset-1 outline-black/5">
                    <p className="text-[11px] font-semibold uppercase tracking-normal text-ink/45">
                      How it runs
                    </p>
                    <ol className="mt-2 space-y-1.5 text-[12px] text-ink/70">
                      <li>
                        <span className="font-bold">Add expenses</span> until {fmtDay(anchor)}
                      </li>
                      <li>
                        <span className="font-bold">Confirm the split</span> — {confirmDays === 7 ? "1 week" : `${confirmDays} day${confirmDays === 1 ? "" : "s"}`}
                      </li>
                      <li>
                        <span className="font-bold">Everyone pays</span> by {fmtDay(payBy)}
                      </li>
                    </ol>
                    {anchor ? (
                      <p className="mt-3 text-[11px] text-ink/45">
                        Then repeats: {nextSettleDates(anchor, frequency, 4).slice(1).map((d) => fmtDay(d)).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-ink/55">
                  No deadlines — anyone can start a settle-up whenever the group is ready.
                </p>
              )}
            </Disclosure>

            <Disclosure
              icon={<Globe className="size-4" />}
              title="Currencies"
              summary={multicurrency ? "Any currency allowed" : "USD only"}
              open={openPanel === "currency"}
              onToggle={() => setOpenPanel(openPanel === "currency" ? null : "currency")}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] text-ink/60">
                  Traveling abroad? Let members log expenses in other currencies — we convert to USD for settling.
                </p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={multicurrency}
                  aria-label="Allow multiple currencies"
                  onClick={() => setMulticurrency((v) => !v)}
                  className={`press relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    multicurrency ? "bg-brand" : "bg-ink/15"
                  }`}
                >
                  <span
                    className={`absolute top-1 size-5 rounded-full bg-white transition-all ${
                      multicurrency ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </Disclosure>

            {error ? <p className="mt-3 text-[12px] font-medium text-money-out">{error}</p> : null}

            <PrimaryButton onClick={submit} disabled={busy || done || !name.trim()} done={done}>
              <span className="inline-flex items-center gap-2">
                {done ? <Check className="size-4" /> : busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {done ? "Group created" : "Create group"}
              </span>
            </PrimaryButton>
          </>
        ) : (
          <>
            <div className="glass card-in mt-4 rounded-[26px] p-5">
              <label className="block">
                <span className="text-[11px] font-semibold text-ink/50">Join code</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="4B2K9X"
                  className="num mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm tracking-normal outline-1 -outline-offset-1 outline-black/8 placeholder:text-ink/30 focus:outline-brand"
                />
              </label>
              <p className="mt-2 text-[11px] text-ink/45">
                Ask an admin for the group's code — you'll find yours on any group page.
              </p>

              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-black/8" />
                <span className="text-[10px] font-bold uppercase tracking-normal text-ink/35">or</span>
                <span className="h-px flex-1 bg-black/8" />
              </div>

              <button
                type="button"
                onClick={() => setScanning(true)}
                className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-soft py-3 text-[12px] font-bold text-brand"
              >
                <QrCode className="size-4" /> Scan QR code
              </button>
            </div>

            {scanning ? (
              <QrScanner
                onClose={() => setScanning(false)}
                onCode={(scanned) => {
                  setCode(scanned);
                  setScanning(false);
                }}
              />
            ) : null}

            {error ? <p className="mt-3 text-[12px] font-medium text-money-out">{error}</p> : null}

            <PrimaryButton onClick={submit} disabled={busy || done || !code.trim()} done={done}>
              <span className="inline-flex items-center gap-2">
                {done ? <Check className="size-4" /> : busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {done ? "You're in" : "Join group"}
              </span>
            </PrimaryButton>
          </>
        )}
      </main>
    </div>
  );
}
