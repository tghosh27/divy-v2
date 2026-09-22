import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function BackHeader({
  eyebrow,
  title,
  right,
  to,
}: {
  eyebrow?: string | undefined;
  title: string;
  right?: ReactNode | undefined;
  to?: string | undefined;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => (to ? router.navigate({ to }) : router.history.back())}
        aria-label="Back"
        className="press grid size-10 shrink-0 place-items-center rounded-full bg-white/55 text-ink/70 outline-1 -outline-offset-1 outline-black/5"
      >
        <ChevronLeft className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="truncate font-display text-xl font-bold leading-tight tracking-tight">
          {title}
        </h1>
      </div>
      {right}
    </div>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

export function AmountPad({
  value,
  onChange,
  max,
}: {
  value: string;
  onChange: (next: string) => void;
  max?: number | undefined;
}) {
  function press(k: string) {
    let next: string;
    if (k === "⌫") {
      next = value.slice(0, -1);
      if (next === "") next = "0";
    } else if (k === "." && value.includes(".")) {
      return;
    } else if (value === "0" && k !== ".") {
      next = k;
    } else {
      const cents = value.split(".")[1];
      if (cents && cents.length === 2 && k !== ".") return;
      next = value + k;
      if (next.replace(".", "").length > 8) return;
    }
    if (max !== undefined && (parseFloat(next) || 0) > max) return;
    onChange(next);
  }

  return (
    <div className="mx-auto mt-3 grid max-w-[260px] grid-cols-3 gap-1.5">
      {KEYS.map((k) => (
        <button
          key={k}
          onClick={() => press(k)}
          className="press num rounded-2xl py-2.5 text-lg font-semibold text-ink/80 hover:bg-white/50"
        >
          {k}
        </button>
      ))}
    </div>
  );
}

export function BigAmount({
  value,
  hint,
  onTap,
}: {
  value: string;
  hint?: string | undefined;
  onTap?: (() => void) | undefined;
}) {
  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={onTap}
        className="glass card-in press flex w-full items-center justify-center gap-1 rounded-[24px] py-5"
      >
        <span className="num text-2xl font-bold text-ink/45">$</span>
        <span className="num text-[44px] font-bold leading-none tracking-tight">{value}</span>
      </button>
      {hint ? (
        <p className="mt-2 px-1 text-[10px] font-semibold uppercase tracking-normal text-ink/45">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  done,
}: {
  children: ReactNode;
  onClick?: (() => void) | undefined;
  disabled?: boolean | undefined;
  done?: boolean | undefined;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`press mt-6 w-full rounded-[22px] py-4 text-sm font-bold text-white transition-all ${
        done
          ? "bg-money-in"
          : disabled
            ? "bg-ink/20"
            : "bg-brand shadow-[0_16px_36px_-12px_rgba(124,58,237,0.7)]"
      }`}
    >
      {children}
    </button>
  );
}

export function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean | undefined;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[13px] text-ink/55">{label}</span>
      <span className={`num text-[13px] ${strong ? "font-bold" : "font-semibold text-ink/80"}`}>
        {value}
      </span>
    </div>
  );
}

export function meta(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — Divy It Up` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — Divy It Up` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
