import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, PiggyBank, Sparkles, Users } from "lucide-react";
import { useState } from "react";

import { PrimaryButton, meta } from "@/components/SubScreen";
import { avatarOptions, avatarSrc, coverOptions, coverSrc } from "@/lib/divy-assets";
import { PhotoPicker } from "@/components/PhotoPicker";
import { useRefreshSnapshot } from "@/lib/divy-client";
import { completeOnboarding, joinGroup } from "@/lib/divy.functions";
import type { GroupKind } from "@/lib/divy-types";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => meta("Welcome", "Set up your Divy profile and start your first group or shared wallet."),
  component: Onboarding,
});

type Path = "demo" | "create" | "join";

function Onboarding() {
  const navigate = useNavigate();
  const refresh = useRefreshSnapshot();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [avatarKey, setAvatarKey] = useState<string>("maya");
  const [path, setPath] = useState<Path>("demo");
  const [groupName, setGroupName] = useState("");
  const [groupKind, setGroupKind] = useState<GroupKind>("split");
  const [coverKey, setCoverKey] = useState<string>("nyc");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await completeOnboarding({
        data: {
          name,
          handle,
          avatarKey,
          demo: path === "demo",
          ...(path === "create" ? { groupName, groupKind, coverKey } : {}),
        },
      });
      if (path === "join" && code.trim()) {
        const res = await joinGroup({ data: { code } });
        if (!res.ok) {
          setError(res.error);
          setBusy(false);
          return;
        }
      }
      await refresh();
      navigate({ to: "/home", replace: true });
    } catch {
      setError("Couldn't finish setup. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="app-backdrop relative min-h-screen w-full overflow-x-hidden font-sans text-ink">

      <main className="relative mx-auto max-w-[430px] px-5 pt-12 pb-16">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-brand" : "bg-ink/12"}`}
            />
          ))}
        </div>

        {step === 0 ? (
          <section className="mt-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold text-brand">
              <Sparkles className="size-3" /> Welcome to Divy
            </span>
            <h1 className="font-display mt-4 text-[32px] font-bold leading-tight tracking-tight">
              Let's make group money boring.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink/60">
              Three quick steps: who you are, how you want to start, and you're in. Everything you add
              from here on saves to your account.
            </p>
            <div className="mt-6 space-y-3">
              <Info icon={Users} title="Split groups" body="Roommates, trips, dinners — balances settle on a cycle." />
              <Info icon={PiggyBank} title="Shared wallets" body="Clubs and teams collect dues and spend from one pot." />
            </div>
            <PrimaryButton onClick={() => setStep(1)}>
              <span className="inline-flex items-center gap-2">
                Get started <ArrowRight className="size-4" />
              </span>
            </PrimaryButton>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="mt-8">
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">
              Who are you on Divy?
            </h1>
            <p className="mt-2 text-sm text-ink/55">Your group mates will see this name and handle.</p>

            <div className="glass card-in mt-5 space-y-4 rounded-[26px] p-5">
              <label className="block">
                <span className="text-[11px] font-semibold text-ink/50">Full name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-1 -outline-offset-1 outline-black/8 placeholder:text-ink/30 focus:outline-brand"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-ink/50">Handle</span>
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@alex.rivera"
                  className="mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-1 -outline-offset-1 outline-black/8 placeholder:text-ink/30 focus:outline-brand"
                />
              </label>
              <PhotoPicker
                label="Profile photo"
                value={avatarKey}
                onChange={setAvatarKey}
                options={avatarOptions}
                srcFor={avatarSrc}
                shape="circle"
                hint="Take one, pick from your photos, or use a default."
              />
            </div>

            <PrimaryButton onClick={() => setStep(2)} disabled={!name.trim()}>
              Continue
            </PrimaryButton>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="mt-8">
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">
              How do you want to start?
            </h1>

            <div className="mt-5 space-y-2.5">
              <Choice
                active={path === "demo"}
                onClick={() => setPath("demo")}
                title="Show me a filled-in demo"
                body="Sample groups, a shared club wallet and history you can poke at."
              />
              <Choice
                active={path === "create"}
                onClick={() => setPath("create")}
                title="Create my first group"
                body="Start clean with a split group or a shared wallet."
              />
              <Choice
                active={path === "join"}
                onClick={() => setPath("join")}
                title="Join with a code"
                body="Someone already made the group and sent you a code."
              />
            </div>

            {path === "create" ? (
              <div className="glass card-in mt-4 space-y-4 rounded-[26px] p-5">
                <label className="block">
                  <span className="text-[11px] font-semibold text-ink/50">Group name</span>
                  <input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Apartment 4B"
                    className="mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-1 -outline-offset-1 outline-black/8 placeholder:text-ink/30 focus:outline-brand"
                  />
                </label>
                <div className="flex gap-2">
                  {(["split", "wallet"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setGroupKind(k)}
                      className={`press flex-1 rounded-2xl py-2.5 text-xs font-bold ${
                        groupKind === k
                          ? "bg-brand text-white"
                          : "bg-white/70 text-ink/60 outline-1 -outline-offset-1 outline-black/8"
                      }`}
                    >
                      {k === "split" ? "Split expenses" : "Shared wallet"}
                    </button>
                  ))}
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-ink/50">Cover</span>
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {coverOptions.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setCoverKey(c.key)}
                        className={`press shrink-0 rounded-2xl p-0.5 ${
                          coverKey === c.key ? "outline-2 outline-brand" : "outline-1 outline-black/8"
                        }`}
                      >
                        <img
                          src={coverSrc(c.key)}
                          alt={c.label}
                          width={56}
                          height={56}
                          className="size-14 rounded-[14px] object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {path === "join" ? (
              <div className="glass card-in mt-4 rounded-[26px] p-5">
                <label className="block">
                  <span className="text-[11px] font-semibold text-ink/50">Join code</span>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="DIVY-4B2K"
                    className="num mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm tracking-normal outline-1 -outline-offset-1 outline-black/8 placeholder:text-ink/30 focus:outline-brand"
                  />
                </label>
              </div>
            ) : null}

            {error ? <p className="mt-3 text-[12px] font-medium text-money-out">{error}</p> : null}

            <PrimaryButton
              onClick={finish}
              disabled={busy || (path === "create" && !groupName.trim()) || (path === "join" && !code.trim())}
            >
              <span className="inline-flex items-center gap-2">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {busy ? "Setting up" : "Finish setup"}
              </span>
            </PrimaryButton>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function Info({ icon: Icon, title, body }: { icon: typeof Users; title: string; body: string }) {
  return (
    <div className="glass card-in flex gap-3 rounded-[22px] p-4">
      <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink/55">{body}</p>
      </div>
    </div>
  );
}

function Choice({
  active,
  onClick,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press glass block w-full rounded-[22px] p-4 text-left ${
        active ? "outline-2 -outline-offset-2 outline-brand" : ""
      }`}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-ink/55">{body}</p>
    </button>
  );
}
