import { Link } from "@tanstack/react-router";
import { Home, Users, Activity, Wallet, Plus } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/wallet", label: "Wallet", icon: Wallet },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-backdrop relative min-h-screen w-full overflow-x-hidden font-sans text-ink">

      <div className="relative mx-auto max-w-[430px] px-5 pb-32 pt-6">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto max-w-[430px] px-5 pb-5">
          <div className="glass relative flex items-center justify-between rounded-[26px] px-3 py-2.5">
            {tabs.slice(0, 2).map((t) => (
              <TabLink key={t.to} {...t} />
            ))}

            <Link
              to="/add-expense"
              aria-label="Add expense"
              className="press -mt-8 grid size-14 shrink-0 place-items-center rounded-full bg-brand text-white shadow-[0_14px_30px_-8px_rgba(124,58,237,0.7)]"
            >
              <Plus className="size-6" />
            </Link>

            {tabs.slice(2).map((t) => (
              <TabLink key={t.to} {...t} />
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}

function TabLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof Home;
}) {
  return (
    <Link
      to={to}
      className="press flex w-16 flex-col items-center gap-1 rounded-2xl py-1 text-ink/45 transition-colors"
      activeProps={{ className: "text-brand" }}
      activeOptions={{ exact: to === "/" }}
    >
      <Icon className="size-5" />
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between">
      <div>
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function money(n: number, showSign = true) {
  const sign = n < 0 ? "-" : showSign ? "+" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}
