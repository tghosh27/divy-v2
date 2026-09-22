import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ReceiptText,
  BarChart3,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Cookie,
  CreditCard,
  DollarSign,
  HelpCircle,
  Layers,
  Lightbulb,
  Lock,
  LogOut,
  MessageCircle,
  Minimize2,
  Pencil,
  ScanFace,
  ScrollText,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  UserRoundX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { BackHeader, meta } from "@/components/SubScreen";
import { avatarOptions, avatarSrc } from "@/lib/divy-assets";
import { PhotoPicker } from "@/components/PhotoPicker";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { updateProfile } from "@/lib/divy.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () => meta("Your profile", "Your Divy handle, settlement score, and account settings."),
  component: ProfileScreen,
});

function ProfileScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const refresh = useRefreshSnapshot();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const save = useServerFn(updateProfile);

  const { me, groups } = data;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me.name);
  const [handle, setHandle] = useState(me.handle);
  const [avatarKey, setAvatarKey] = useState(me.avatarKey);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [miniView, setMiniView] = useState(false);
  const [open, setOpen] = useState<string | null>("Account details");

  async function handleSave() {
    setSaving(true);
    try {
      await save({ data: { name, handle, avatarKey } });
      await refresh();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const memberCount = groups.reduce((n, g) => n + g.members, 0);

  return (
    <AppShell>
      <BackHeader
        eyebrow="Account"
        title="Profile"
        to="/home"
        right={
          <button
            onClick={() => setEditing((v) => !v)}
            aria-label={editing ? "Cancel editing" : "Edit profile"}
            className="press grid size-10 place-items-center rounded-full bg-white/55 text-ink/60 outline-1 -outline-offset-1 outline-black/5"
          >
            {editing ? <Check className="size-4" /> : <Pencil className="size-4" />}
          </button>
        }
      />

      <div className="glass card-in mt-5 rounded-[28px] p-5 text-center">
        <img
          src={avatarSrc(avatarKey)}
          alt={me.name}
          className="mx-auto size-20 rounded-full outline-2 -outline-offset-1 outline-white"
        />

        {editing ? (
          <div className="mt-4 space-y-3 text-left">
            <PhotoPicker
              label="Profile photo"
              value={avatarKey}
              onChange={setAvatarKey}
              options={avatarOptions}
              srcFor={avatarSrc}
              shape="circle"
              hint="Take a new one or pick from your photos."
            />
            <label className="block">
              <span className="text-[11px] font-semibold text-ink/50">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-2xl bg-white/70 px-4 py-2.5 text-sm outline-1 -outline-offset-1 outline-black/8 focus:outline-brand"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-ink/50">Handle</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@you"
                className="mt-1 w-full rounded-2xl bg-white/70 px-4 py-2.5 text-sm outline-1 -outline-offset-1 outline-black/8 focus:outline-brand"
              />
            </label>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="press w-full rounded-2xl bg-brand py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : (
          <>
            <p className="font-display mt-3 text-xl font-bold">{me.name}</p>
            <p className="text-[12px] text-ink/50">{me.handle || "No handle set"}</p>
          </>
        )}

        {!editing ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Link to="/score" className="press">
              <Stat label="Divy score" value={String(me.score)} tone="in" />
            </Link>
            <Stat label="Groups" value={String(groups.length)} />
            <Stat
              label="On-time"
              value={`${Math.round((data.scoreBreakdown.factors[0]?.points ?? 0) * 2.5)}%`}
              tone="in"
            />
          </div>
        ) : null}
      </div>

      {!editing ? (
        <>
          <Section
            title="Account details"
            open={open}
            setOpen={setOpen}
            delay="0.06s"
            rows={[
              { icon: UserRoundCog, label: "Edit profile", onClick: () => setEditing(true) },
              {
                icon: Minimize2,
                label: "Mini view",
                sub: `Simple expense tracking · ${groups.length} groups, ${memberCount} members`,
                toggle: miniView,
                onToggle: () => setMiniView((v) => !v),
              },
              { icon: DollarSign, label: "Default currency", sub: "USD" },
              { icon: Bell, label: "Notification settings", to: "/notifications" },
              { icon: MessageCircle, label: "Divy GPT settings", sub: "Voice, spoken replies, assistant preferences" },
              { icon: Cookie, label: "App permissions" },
            ]}
          />

          <Section
            title="Your security"
            open={open}
            setOpen={setOpen}
            delay="0.09s"
            rows={[
              { icon: ScanFace, label: "Face ID", sub: "Not available on this device", toggle: false, disabled: true },
              { icon: Lock, label: "Privacy & security" },
              { icon: Trash2, label: "Delete account", danger: true },
            ]}
          />

          <Section
            title="Wallet management"
            open={open}
            setOpen={setOpen}
            delay="0.12s"
            rows={[
              { icon: Layers, label: "Manage Divy wallets", sub: "Balances and shared wallet info", to: "/wallet" },
              {
                icon: CreditCard,
                label: "Linked bank accounts",
                sub: "View, link, and manage accounts",
                to: "/wallet-accounts",
              },
              {
                icon: ReceiptText,
                label: "Payment history & statements",
                sub: "Every payment, exportable as a spreadsheet",
                to: "/history",
              },
              { icon: UserRoundX, label: "Close Divy wallet", sub: "Review balance, fees, and final steps" },
            ]}
          />

          <Section
            title="Banking & fees"
            open={open}
            setOpen={setOpen}
            delay="0.15s"
            rows={[
              { icon: ShieldCheck, label: "Get onboarded", sub: "Identity verification and account setup" },
              { icon: Building2, label: "Bank linking", sub: "Connect a bank for transfers" },
              { icon: BarChart3, label: "Transfer limits", sub: "Daily and monthly caps" },
              { icon: DollarSign, label: "Fees", sub: "Wallet service and transfer pricing" },
            ]}
          />

          <Section
            title="More"
            open={open}
            setOpen={setOpen}
            delay="0.18s"
            rows={[
              { icon: Compass, label: "Take a tour" },
              { icon: HelpCircle, label: "Help & support" },
              { icon: Lightbulb, label: "Request features" },
              { icon: ScrollText, label: "Terms & conditions" },
              { icon: ShieldCheck, label: "Privacy policy" },
            ]}
          />

          <div
            className="glass card-in mt-4 flex items-start gap-3 rounded-[22px] p-4"
            style={{ animationDelay: "0.21s" }}
          >
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-money-in" />
            <p className="text-[12px] leading-relaxed text-ink/60">
              Your settle score of {me.score} means groups can trust you to close out cycles on time. It rises every
              time you settle before the deadline.
            </p>
          </div>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="press mt-4 flex w-full items-center justify-center gap-2 rounded-[20px] bg-white/60 py-3.5 text-[12px] font-bold text-money-out outline-1 -outline-offset-1 outline-black/8 disabled:opacity-50"
          >
            <LogOut className="size-4" /> {signingOut ? "Signing out…" : "Sign out"}
          </button>

          <div className="mt-6 space-y-0.5 text-center text-[11px] text-ink/40">
            <p>Version 1.15.1</p>
            <p>Divy It Up!, LLC · New Haven, CT, USA</p>
            <p>www.divyitup.com</p>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}

type Row = {
  icon: LucideIcon;
  label: string;
  sub?: string;
  to?: "/notifications" | "/wallet" | "/wallet-accounts" | "/history";
  onClick?: () => void;
  toggle?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  danger?: boolean;
};

function Section({
  title,
  rows,
  open,
  setOpen,
  delay,
}: {
  title: string;
  rows: Row[];
  open: string | null;
  setOpen: (v: string | null) => void;
  delay: string;
}) {
  const isOpen = open === title;
  return (
    <div className="glass card-in mt-4 rounded-[24px] px-4" style={{ animationDelay: delay }}>
      <button
        onClick={() => setOpen(isOpen ? null : title)}
        className="press flex w-full items-center justify-between py-4 text-left"
      >
        <span className="font-display text-[14px] font-bold">{title}</span>
        <ChevronDown className={`size-4 text-ink/35 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="border-t border-black/5">
          {rows.map((r, i, arr) => {
            const inner = (
              <>
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                    r.danger ? "bg-money-out/10 text-money-out" : "bg-brand-soft text-brand"
                  }`}
                >
                  <r.icon className="size-4" />
                </span>
                <span className="flex-1">
                  <span className={`block text-[13px] font-semibold ${r.danger ? "text-money-out" : ""}`}>
                    {r.label}
                  </span>
                  {r.sub ? <span className="mt-0.5 block text-[11px] text-ink/45">{r.sub}</span> : null}
                </span>
                {r.toggle === undefined ? (
                  <ChevronRight className="size-4 text-ink/30" />
                ) : (
                  <span
                    className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                      r.toggle ? "bg-brand" : "bg-black/12"
                    } ${r.disabled ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${
                        r.toggle ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </span>
                )}
              </>
            );
            const cls = `press flex w-full items-center gap-3 py-3.5 text-left ${
              i < arr.length - 1 ? "border-b border-black/5" : ""
            }`;
            if (r.to) {
              return (
                <Link key={r.label} to={r.to} className={cls}>
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={r.label}
                disabled={r.disabled}
                onClick={r.onToggle ?? r.onClick}
                className={cls}
              >
                {inner}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "in" | undefined }) {
  return (
    <div className="rounded-2xl bg-white/55 p-3 outline-1 -outline-offset-1 outline-black/5">
      <p className={`num text-lg font-bold leading-none ${tone === "in" ? "text-money-in" : "text-ink"}`}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold text-ink/45">{label}</p>
    </div>
  );
}
