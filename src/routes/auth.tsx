import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Divy It Up" },
      {
        name: "description",
        content: "Sign in or create your Divy account to track group expenses, settle cycles and manage shared wallets.",
      },
      { property: "og:title", content: "Sign in — Divy It Up" },
      { property: "og:description", content: "Sign in to Divy to settle group money in a tap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthScreen,
});

function AuthScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/home", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice("Check your email to confirm your account, then come back and sign in.");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
      navigate({ to: "/home", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "apple") {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("That sign-in didn't go through. Try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/home", replace: true });
  }

  return (
    <div className="app-backdrop relative min-h-screen w-full overflow-x-hidden font-sans text-ink">

      <main className="relative mx-auto max-w-[430px] px-5 pt-16">
        <Link to="/" className="text-[10px] font-semibold uppercase tracking-normal text-brand">
          Divy It Up
        </Link>
        <h1 className="font-display mt-3 text-[30px] font-bold leading-tight tracking-tight">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-ink/55">
          {mode === "signup"
            ? "One account for every group, cycle and wallet."
            : "Pick up right where your groups left off."}
        </p>

        <div className="glass card-in mt-6 rounded-[26px] p-5">
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => social("google")}
              disabled={busy}
              className="press flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-semibold outline-1 -outline-offset-1 outline-black/8"
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => social("apple")}
              disabled={busy}
              className="press flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 text-sm font-semibold text-white"
            >
              Continue with Apple
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-normal text-ink/35">
            <span className="h-px flex-1 bg-black/8" /> or <span className="h-px flex-1 bg-black/8" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-ink/50">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-1 -outline-offset-1 outline-black/8 placeholder:text-ink/30 focus:outline-brand"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-ink/50">Password</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-1 -outline-offset-1 outline-black/8 placeholder:text-ink/30 focus:outline-brand"
              />
            </label>

            {error ? <p className="text-[12px] font-medium text-money-out">{error}</p> : null}
            {notice ? <p className="text-[12px] font-medium text-money-in">{notice}</p> : null}

            <button
              type="submit"
              disabled={busy}
              className="press flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError(null);
              setNotice(null);
            }}
            className="mt-4 w-full text-center text-xs font-semibold text-brand"
          >
            {mode === "signup" ? "I already have an account" : "New here? Create an account"}
          </button>
        </div>
      </main>
    </div>
  );
}
