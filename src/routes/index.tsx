import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, PiggyBank, RefreshCcw, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Divy It Up — Settle Group Money Without the Awkward Part" },
      {
        name: "description",
        content:
          "Divy keeps group money straight: settlement cycles, shared group wallets for clubs and teams, and one-tap settle-up between friends.",
      },
      { property: "og:title", content: "Divy It Up — Settle Group Money Without the Awkward Part" },
      {
        property: "og:description",
        content: "Settlement cycles, shared group wallets, and one-tap settle-up. Built for roommates, trips, clubs and teams.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="app-backdrop relative min-h-screen w-full overflow-x-hidden font-sans text-ink">

      <main className="relative mx-auto max-w-[430px] px-5 py-12">
        <p className="text-[10px] font-semibold uppercase tracking-normal text-brand">Divy It Up</p>
        <h1 className="font-display mt-3 text-[38px] font-bold leading-[1.05] tracking-tight">
          Group money,
          <br />
          finally settled.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink/60">
          Track what everyone owes, close a cycle, and settle up in a tap. Clubs and teams get a shared
          wallet with dues, funding requests and a full paper trail.
        </p>

        <div className="mt-7 space-y-3">
          <Link
            to={signedIn ? "/home" : "/auth"}
            className="press flex items-center justify-center gap-2 rounded-full bg-brand py-4 text-[15px] font-bold text-white shadow-[0_16px_34px_-12px_rgba(124,58,237,0.7)]"
          >
            {signedIn ? "Open Divy" : "Get started"} <ArrowRight className="size-4" />
          </Link>
          {signedIn ? null : (
            <Link
              to="/auth"
              className="press glass flex items-center justify-center rounded-full py-3.5 text-sm font-semibold"
            >
              I already have an account
            </Link>
          )}
        </div>

        <div className="mt-10 space-y-3">
          <Feature icon={RefreshCcw} title="Settlement cycles" body="Close the books on a period instead of chasing single payments." />
          <Feature icon={PiggyBank} title="Shared group wallets" body="Collect dues, hold the money together, and spend it in the open." />
          <Feature icon={Users} title="One-tap settle-up" body="Pay what you owe from your Divy wallet or a linked account." />
        </div>
      </main>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Users;
  title: string;
  body: string;
}) {
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
