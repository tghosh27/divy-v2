import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  Check,
  UtensilsCrossed,
  BedDouble,
  Car,
  ShoppingBag,
  Clapperboard,
  Zap,
  Plane,
  Wine,
  ReceiptText,
  Camera,
  CalendarDays,
  Repeat,
  Images,
  Trash2,
  Percent,
  DollarSign,
  Scale,
  Equal,
  X,
  Sparkles,
  Loader2,
  ListOrdered,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { avatarSrc, coverSrc } from "@/lib/divy-assets";
import { addExpense } from "@/lib/divy.functions";
import { scanReceipt } from "@/lib/receipt.functions";
import { fileToPhotoKey } from "@/lib/photo-input";
import {
  RECUR_LABEL,
  itemizedShares,
  type ExpenseItem,
  type RecurFreq,
} from "@/lib/divy-types";

export const Route = createFileRoute("/_authenticated/add-expense")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () => ({
    meta: [
      { title: "Add Expense — Divy It Up" },
      { name: "description", content: "Add a shared expense to a group and split it." },
      { property: "og:title", content: "Add Expense — Divy It Up" },
      { property: "og:description", content: "Add a shared expense to a group and split it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AddExpenseScreen,
});

const categories = [
  { id: "food", label: "Food", icon: UtensilsCrossed },
  { id: "lodging", label: "Stay", icon: BedDouble },
  { id: "transport", label: "Rides", icon: Car },
  { id: "groceries", label: "Grocery", icon: ShoppingBag },
  { id: "fun", label: "Fun", icon: Clapperboard },
  { id: "utilities", label: "Bills", icon: Zap },
  { id: "travel", label: "Travel", icon: Plane },
  { id: "drinks", label: "Drinks", icon: Wine },
];

const splitMethods = [
  { id: "equal", label: "Equally", icon: Equal },
  { id: "percent", label: "Percentage", icon: Percent },
  { id: "amount", label: "Amount", icon: DollarSign },
  { id: "shares", label: "Shares", icon: Scale },
] as const;

type SplitMethod = (typeof splitMethods)[number]["id"];

/** Splits `total` across `ids`, honoring typed values and auto-filling the rest. */
function computeSplit(
  method: SplitMethod,
  ids: string[],
  total: number,
  inputs: Record<string, string>,
  touched: string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!ids.length) return out;

  if (method === "equal") {
    const each = total / ids.length;
    ids.forEach((id) => (out[id] = each));
    return out;
  }

  if (method === "shares") {
    const weights = ids.map((id) => {
      const w = parseFloat(inputs[id] ?? "");
      return touched.includes(id) && w > 0 ? w : 1;
    });
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    ids.forEach((id, i) => (out[id] = (total * (weights[i] ?? 1)) / sum));
    return out;
  }

  // percent / amount: typed values are fixed, remainder spreads across untyped
  const target = method === "percent" ? 100 : total;
  const fixed = ids.filter((id) => touched.includes(id));
  const rest = ids.filter((id) => !touched.includes(id));
  let used = 0;
  const raw: Record<string, number> = {};
  fixed.forEach((id) => {
    const v = Math.max(0, parseFloat(inputs[id] ?? "") || 0);
    raw[id] = v;
    used += v;
  });
  const leftover = Math.max(0, target - used);
  const per = rest.length ? leftover / rest.length : 0;
  rest.forEach((id) => (raw[id] = per));
  ids.forEach((id) => {
    out[id] = method === "percent" ? (total * (raw[id] ?? 0)) / 100 : (raw[id] ?? 0);
  });
  return out;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

function AddExpenseScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const navigate = useNavigate();
  const create = useServerFn(addExpense);
  const scan = useServerFn(scanReceipt);
  const refresh = useRefreshSnapshot();

  const groups = data.groups;
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [amount, setAmount] = useState("0.00");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("food");
  const detailForGroup = data.groupDetails[groupId];
  const [payer, setPayer] = useState(detailForGroup?.yourMemberId ?? "");
  const [split, setSplit] = useState<SplitMethod>("equal");
  const [splitOpen, setSplitOpen] = useState(false);
  const [included, setIncluded] = useState<string[]>(
    () => detailForGroup?.members.map((m) => m.id) ?? [],
  );
  const [splitInputs, setSplitInputs] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<string[]>([]);

  const [items, setItems] = useState<ExpenseItem[] | null>(null);
  const [tax, setTax] = useState(0);
  const [tip, setTip] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const rosterKey = (data.groupDetails[groupId]?.members ?? []).map((m) => m.id).join(",");
  useEffect(() => {
    setIncluded(rosterKey ? rosterKey.split(",") : []);
    setSplitInputs({});
    setTouched([]);
    setSplit("equal");
    setItems(null);
    setTax(0);
    setTip(0);
    setScanError(null);
  }, [rosterKey]);
  const [groupOpen, setGroupOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [recur, setRecur] = useState<RecurFreq | null>(null);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [posted, setPosted] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!groups.length) {
    return (
      <AppShell>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/home" })}
            aria-label="Back"
            className="press grid size-10 place-items-center rounded-full bg-white/55 text-ink/70 outline-1 -outline-offset-1 outline-black/5"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="font-display text-xl font-bold leading-tight tracking-tight">Add expense</h1>
        </div>
        <div className="glass card-in mt-6 rounded-[24px] p-6 text-center">
          <p className="text-sm font-semibold">You don't have any groups yet</p>
          <p className="mt-1 text-[12px] text-ink/50">Create a group first to start adding expenses.</p>
          <Link
            to="/groups"
            className="press mt-4 inline-block rounded-[18px] bg-brand px-5 py-3 text-[12px] font-bold text-white"
          >
            Go to groups
          </Link>
        </div>
      </AppShell>
    );
  }

  const group = groups.find((g) => g.id === groupId) ?? groups[0]!;
  const detail = data.groupDetails[group.id];
  const members = detail?.members ?? [];
  const isWallet = group.kind === "wallet";
  const num = parseFloat(amount) || 0;
  const each = group.members > 0 ? num / group.members : 0;

  const includedIds = members.filter((m) => included.includes(m.id)).map((m) => m.id);
  const itemized = !!items && items.length > 0 && !isWallet;
  const shares = itemized
    ? itemizedShares(items!, includedIds, tax, tip)
    : computeSplit(split, includedIds, num, splitInputs, touched);
  const methodLabel = itemized
    ? "By item"
    : (splitMethods.find((s) => s.id === split)?.label ?? "Equally");
  const itemizedShort =
    itemized &&
    Math.abs(Object.values(shares).reduce((a, b) => a + b, 0) - num) > 0.02;
  // While splitting by item, the bill amount is the sum of the lines + tax + tip,
  // so the assigned total can never drift above or below the bill.
  useEffect(() => {
    if (!itemized) return;
    const sum =
      (items ?? []).reduce((a, i) => a + (i.amount || 0), 0) + (tax || 0) + (tip || 0);
    if (sum > 0) setAmount(sum.toFixed(2));
  }, [items, tax, tip, itemized]);
  const splitTarget = split === "percent" ? 100 : num;
  const typedSum = includedIds
    .filter((id) => touched.includes(id))
    .reduce((a, id) => a + (parseFloat(splitInputs[id] ?? "") || 0), 0);
  const untypedCount = includedIds.filter((id) => !touched.includes(id)).length;
  const autoValue = untypedCount ? Math.max(0, splitTarget - typedSum) / untypedCount : 0;
  const overAllocated = typedSum > splitTarget + 0.005;
  function displayValue(id: string) {
    if (split === "shares") return touched.includes(id) ? (splitInputs[id] ?? "") : "1";
    if (touched.includes(id)) return splitInputs[id] ?? "";
    return split === "percent" ? autoValue.toFixed(autoValue % 1 === 0 ? 0 : 1) : autoValue.toFixed(2);
  }
  const splitSummary =
    includedIds.length === 0
      ? "No one selected"
      : itemized
        ? `${items!.length} items · tax & tip split evenly`
        : split === "equal"
          ? `${includedIds.length} people · $${(num / includedIds.length).toFixed(2)} each`
          : `${methodLabel} · ${includedIds.length} people`;

  function toggleMember(id: string) {
    setIncluded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setTouched((prev) => prev.filter((x) => x !== id));
  }

  function setSplitValue(id: string, raw: string) {
    const clean = raw.replace(/[^0-9.]/g, "");
    setSplitInputs((prev) => ({ ...prev, [id]: clean }));
    setTouched((prev) => (clean === "" ? prev.filter((x) => x !== id) : prev.includes(id) ? prev : [...prev, id]));
  }

  function pickMethod(m: SplitMethod) {
    setSplit(m);
    setSplitInputs({});
    setTouched([]);
  }

  function pressKey(k: string) {
    setAmount((prev) => {
      if (k === "⌫") {
        const next = prev.slice(0, -1);
        return next === "" ? "0.00" : next;
      }
      if (k === "." && prev.includes(".")) return prev;
      if (prev === "0.00" && k !== ".") return k;
      const cents = prev.split(".")[1];
      if (cents && cents.length === 2 && k !== ".") return prev;
      const next = prev + k;
      if (next.replace(".", "").length > 8) return prev;
      return next;
    });
  }

  function selectGroup(id: string) {
    setGroupId(id);
    const d = data.groupDetails[id];
    setPayer(d?.yourMemberId ?? d?.members[0]?.id ?? "");
  }

  /** Read the receipt photo and turn it into line items. */
  async function runScan() {
    if (!receipt || scanning) return;
    setScanning(true);
    setScanError(null);
    const res = await scan({ data: { image: receipt } });
    setScanning(false);
    if (!res.ok) {
      setScanError(res.error);
      return;
    }
    setItems(res.receipt.items.map((i) => ({ ...i, memberIds: includedIds })));
    setTax(res.receipt.tax);
    setTip(res.receipt.tip);
    setAmount(res.receipt.total.toFixed(2));
  }

  function toggleItemMember(index: number, memberId: string) {
    setItems((prev) =>
      (prev ?? []).map((item, i) => {
        if (i !== index) return item;
        const on = item.memberIds.includes(memberId);
        return {
          ...item,
          memberIds: on
            ? item.memberIds.filter((id) => id !== memberId)
            : [...item.memberIds, memberId],
        };
      }),
    );
  }

  async function save() {
    if (num <= 0 || saving) return;
    setSaving(true);
    const custom = itemized || split !== "equal";
    const res = await create({
      data: {
        groupId: group.id,
        title: note.trim() || "Expense",
        total: num,
        category,
        payerMemberId: payer || null,
        receiptKey: receipt,
        recurFreq: recur,
        shares: custom && !isWallet ? shares : null,
        items: itemized ? items : null,
      },
    });
    setSaving(false);
    if (!res.ok) return;
    setPosted(true);
    await refresh();
    setTimeout(() => navigate({ to: "/home" }), 900);
  }

  return (
    <AppShell>
      {/* header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/home" })}
          aria-label="Back"
          className="press grid size-10 place-items-center rounded-full bg-white/55 text-ink/70 outline-1 -outline-offset-1 outline-black/5"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
            Add expense to
          </p>
          <h1 className="font-display text-xl font-bold leading-tight tracking-tight">
            {group.name}
          </h1>
        </div>
      </div>

      {/* group picker — dropdown bar */}
      <div className="relative z-20 mt-5">
        <button
          onClick={() => setGroupOpen((v) => !v)}
          aria-expanded={groupOpen}
          aria-haspopup="listbox"
          className="glass card-in press flex w-full items-center gap-3 rounded-[22px] p-3 text-left"
        >
          <img
            src={coverSrc(group.coverKey)}
            alt={group.name}
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{group.name}</p>
            <p className="text-[11px] text-ink/50">{group.members} members</p>
          </div>
          <ChevronDown
            className={`size-4 shrink-0 text-ink/40 transition-transform ${groupOpen ? "rotate-180" : ""}`}
          />
        </button>
        {groupOpen ? (
          <>
            <button
              aria-label="Close group list"
              onClick={() => setGroupOpen(false)}
              className="fixed inset-0 z-30 cursor-default"
            />
            <div
              role="listbox"
              aria-label="Your groups"
              className="glass card-in absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-[290px] overflow-y-auto rounded-[22px] p-1.5"
            >
              {groups.map((g) => {
                const selected = g.id === groupId;
                return (
                  <button
                    key={g.id}
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      selectGroup(g.id);
                      setGroupOpen(false);
                    }}
                    className={`press flex w-full items-center gap-3 rounded-[16px] p-2 text-left transition-colors ${
                      selected
                        ? "bg-brand-soft outline-1 -outline-offset-1 outline-brand/25"
                        : "hover:bg-white/55"
                    }`}
                  >
                    <img
                      src={coverSrc(g.coverKey)}
                      alt=""
                      width={36}
                      height={36}
                      className="size-9 shrink-0 rounded-[10px] object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{g.name}</p>
                      <p className="text-[11px] text-ink/50">{g.members} members</p>
                    </div>
                    {selected ? (
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white">
                        <Check className="size-3" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      {/* amount */}
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setKeypadOpen((v) => !v)}
          aria-expanded={keypadOpen}
          aria-label={keypadOpen ? "Hide keypad" : "Enter amount"}
          className={`glass card-in press flex w-full items-center justify-center gap-1 rounded-[24px] py-5 transition-shadow ${
            num > 0
              ? "shadow-[0_18px_40px_-16px_rgba(124,58,237,0.5)]"
              : ""
          }`}
        >
          <span className="num text-2xl font-bold text-ink/45">$</span>
          <span className="num text-[44px] font-bold leading-none tracking-tight">
            {amount}
          </span>
        </button>
        <div className="mt-2 flex items-center justify-between px-1">
          <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
            Amount · tap to {keypadOpen ? "hide" : "enter"}
          </p>
          {num > 0 && split === "equal" && !isWallet ? (
            <p className="num text-[11px] font-semibold text-brand">
              ${each.toFixed(2)} each × {group.members}
            </p>
          ) : null}
        </div>
      </div>

      {/* keypad */}
      {keypadOpen ? (
        <div className="mx-auto mt-3 grid max-w-[260px] grid-cols-3 gap-1.5">
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => pressKey(k)}
              className="press num rounded-2xl py-2.5 text-lg font-semibold text-ink/80 hover:bg-white/50"
            >
              {k}
            </button>
          ))}
        </div>
      ) : null}

      {/* note + category */}
      <div className="glass card-in mt-4 rounded-[22px] p-3" style={{ animationDelay: "0.06s" }}>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What was it for?"
          className="w-full rounded-xl bg-white/60 px-3.5 py-3 text-sm font-medium text-ink outline-1 -outline-offset-1 outline-black/5 placeholder:text-ink/35 focus:outline-brand/40"
        />
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`press flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                category === c.id
                  ? "bg-brand text-white"
                  : "bg-white/55 text-ink/60 outline-1 -outline-offset-1 outline-black/5"
              }`}
            >
              <c.icon className="size-3.5" />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* paid by + split */}
      <div className="glass card-in mt-3 rounded-[22px] p-3" style={{ animationDelay: "0.12s" }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink/70">Paid by</p>
          <div className="flex items-center gap-1.5">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setPayer(m.id)}
                className={`press flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[11px] font-semibold transition-colors ${
                  payer === m.id
                    ? "bg-brand-soft text-brand outline-1 -outline-offset-1 outline-brand/30"
                    : "bg-white/55 text-ink/55 outline-1 -outline-offset-1 outline-black/5"
                }`}
              >
                <img src={avatarSrc(m.avatarKey)} alt="" className="size-5 rounded-full" />
                {m.name}
                {payer === m.id ? <Check className="size-3" /> : null}
              </button>
            ))}
          </div>
        </div>

        {isWallet ? (
          <div className="mt-3 border-t border-black/5 pt-3">
            <p className="text-sm font-medium text-ink/70">Nothing gets split</p>
            <p className="mt-0.5 text-[11px] text-ink/45">
              Whoever paid gets the full ${num.toFixed(2)} back from the shared wallet once an admin
              approves it.
            </p>
          </div>
        ) : (
          <button
            onClick={() => setSplitOpen(true)}
            aria-expanded={splitOpen}
            className="press mt-3 flex w-full items-center justify-between border-t border-black/5 pt-3 text-left"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink/70">Split between</p>
              <p className="num mt-0.5 truncate text-[11px] text-ink/45">{splitSummary}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1.5 text-[11px] font-semibold text-brand outline-1 -outline-offset-1 outline-brand/25">
              {methodLabel}
              <ChevronDown className="size-3.5" />
            </span>
          </button>
        )}
      </div>

      {/* more options */}
      <button
        onClick={() => setMoreOpen((v) => !v)}
        className="press mt-4 flex w-full items-center justify-between px-1"
      >
        <span className="text-sm font-semibold text-ink/70">More options</span>
        <ChevronDown
          className={`size-4 text-ink/45 transition-transform ${moreOpen ? "rotate-180" : ""}`}
        />
      </button>
      {moreOpen ? (
        <div className="glass card-in mt-2 rounded-[22px] p-3">
          {/* receipt */}
          <p className="text-[11px] font-semibold text-ink/50">Receipt</p>
          <div className="mt-2 flex items-center gap-3">
            {receipt ? (
              <img
                src={receipt}
                alt="Receipt"
                className="size-16 shrink-0 rounded-[16px] object-cover outline-1 -outline-offset-1 outline-black/8"
              />
            ) : (
              <span className="grid size-16 shrink-0 place-items-center rounded-[16px] bg-brand-soft text-brand">
                <ReceiptText className="size-6" />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              <label className="press flex cursor-pointer items-center gap-1.5 rounded-full bg-white/70 px-3 py-2 text-[11px] font-semibold text-ink/70 outline-1 -outline-offset-1 outline-black/8">
                <Images className="size-3.5 text-brand" /> My photos
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setReceiptError(null);
                    try {
                      setReceipt(await fileToPhotoKey(file, 900));
                    } catch (err) {
                      setReceiptError(err instanceof Error ? err.message : "Could not use that photo");
                    }
                  }}
                />
              </label>
              <label className="press flex cursor-pointer items-center gap-1.5 rounded-full bg-white/70 px-3 py-2 text-[11px] font-semibold text-ink/70 outline-1 -outline-offset-1 outline-black/8">
                <Camera className="size-3.5 text-brand" /> Take photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setReceiptError(null);
                    try {
                      setReceipt(await fileToPhotoKey(file, 900));
                    } catch (err) {
                      setReceiptError(err instanceof Error ? err.message : "Could not use that photo");
                    }
                  }}
                />
              </label>
              {receipt ? (
                <button
                  onClick={() => {
                    setReceipt(null);
                    setItems(null);
                    setTax(0);
                    setTip(0);
                    setScanError(null);
                  }}
                  className="press flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-2 text-[11px] font-semibold text-money-out outline-1 -outline-offset-1 outline-black/8"
                >
                  <Trash2 className="size-3.5" /> Remove
                </button>
              ) : null}
            </div>
          </div>
          {receiptError ? (
            <p className="mt-2 text-[11px] font-semibold text-money-out">{receiptError}</p>
          ) : null}

          {/* read the receipt line by line */}
          {receipt && !isWallet ? (
            <div className="mt-3">
              <button
                onClick={runScan}
                disabled={scanning}
                className="press flex w-full items-center justify-center gap-2 rounded-[16px] bg-brand px-4 py-3 text-[12px] font-bold text-white disabled:opacity-60"
              >
                {scanning ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {scanning ? "Reading the receipt…" : items ? "Read it again" : "Split by item"}
              </button>
              <p className="mt-2 text-[11px] text-ink/45">
                We read each line off the photo, then you tap who shared what. Tax and tip split
                evenly across everyone.
              </p>
              {scanError ? (
                <p className="mt-2 text-[11px] font-semibold text-money-out">{scanError}</p>
              ) : null}
            </div>
          ) : null}

          {/* line items */}
          {itemized ? (
            <div className="mt-3 border-t border-black/5 pt-3">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink/50">
                  <ListOrdered className="size-3.5 text-brand" /> {items!.length} items
                </p>
                <button
                  onClick={() => setItems(null)}
                  className="press text-[11px] font-semibold text-ink/45"
                >
                  Clear
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {items!.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="rounded-[16px] bg-white/70 p-2.5 outline-1 -outline-offset-1 outline-black/8"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate text-[12px] font-semibold">{item.name}</p>
                      <p className="num shrink-0 text-[12px] font-bold">
                        ${item.amount.toFixed(2)}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {members.map((m) => {
                        const on = item.memberIds.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            onClick={() => toggleItemMember(index, m.id)}
                            aria-pressed={on}
                            className={`press flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[11px] font-semibold outline-1 -outline-offset-1 transition-all ${
                              on
                                ? "bg-brand text-white outline-transparent"
                                : "bg-white text-ink/50 outline-black/8"
                            }`}
                          >
                            <img
                              src={avatarSrc(m.avatarKey)}
                              alt=""
                              className={`size-5 rounded-full object-cover ${on ? "" : "opacity-60"}`}
                            />
                            {m.name.split(" ")[0]}
                          </button>
                        );
                      })}
                    </div>
                    {item.memberIds.length === 0 ? (
                      <p className="mt-1.5 text-[10px] font-semibold text-money-out">
                        Nobody on this line yet
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[10px] font-semibold text-ink/45">
                        {item.memberIds.length === includedIds.length
                          ? "Everyone"
                          : `${item.memberIds.length} ${item.memberIds.length === 1 ? "person" : "people"}`}
                        {" · "}${(item.amount / item.memberIds.length).toFixed(2)} each
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-1.5">
                {(
                  [
                    ["Tax", tax, setTax] as const,
                    ["Tip", tip, setTip] as const,
                  ]
                ).map(([label, value, setValue]) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-ink/70">
                      {label} <span className="text-ink/40">· split evenly</span>
                    </p>
                    <div className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1.5 outline-1 -outline-offset-1 outline-black/8">
                      <span className="text-[11px] font-semibold text-ink/40">$</span>
                      <input
                        value={value ? String(value) : ""}
                        onChange={(e) =>
                          setValue(Math.max(0, parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0))
                        }
                        inputMode="decimal"
                        placeholder="0.00"
                        aria-label={label}
                        className="num w-16 bg-transparent text-right text-[12px] font-bold outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 border-t border-black/5 pt-2.5 space-y-1">
                {members
                  .filter((m) => includedIds.includes(m.id))
                  .map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[12px] text-ink/70">{m.name}</p>
                      <p className="num shrink-0 text-[12px] font-bold">
                        ${(shares[m.id] ?? 0).toFixed(2)}
                      </p>
                    </div>
                  ))}
                <div className="flex items-center justify-between gap-2 border-t border-black/5 pt-1.5">
                  <p className="text-[12px] font-semibold">Assigned</p>
                  <p
                    className={`num text-[12px] font-bold ${
                      Math.abs(
                        Object.values(shares).reduce((a, b) => a + b, 0) - num,
                      ) > 0.02
                        ? "text-money-out"
                        : "text-money-in"
                    }`}
                  >
                    ${Object.values(shares).reduce((a, b) => a + b, 0).toFixed(2)} of $
                    {num.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}


          {/* repeat */}
          <p className="mt-4 border-t border-black/5 pt-3 text-[11px] font-semibold text-ink/50">
            Repeat this expense
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {([null, "weekly", "biweekly", "monthly"] as const).map((f) => {
              const on = recur === f;
              return (
                <button
                  key={f ?? "once"}
                  onClick={() => setRecur(f)}
                  className={`press flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold outline-1 -outline-offset-1 transition-all ${
                    on ? "bg-brand text-white outline-transparent" : "bg-white/70 text-ink/70 outline-black/8"
                  }`}
                >
                  {f ? <Repeat className="size-3.5" /> : null}
                  {f ? RECUR_LABEL[f] : "Just once"}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-ink/45">
            {recur
              ? isWallet
                ? "We'll add this expense to the group automatically, same amount."
                : "We'll add this expense to the group automatically, same amount and split."
              : "Posts one time only."}
          </p>
        </div>
      ) : null}

      {/* save */}
      <button
        onClick={save}
        disabled={(num <= 0 || saving || itemizedShort) && !posted}
        className={`press mt-6 w-full rounded-[22px] py-4 text-sm font-bold text-white transition-all ${
          posted
            ? "bg-money-in"
            : num > 0 && !itemizedShort
              ? "bg-brand shadow-[0_16px_36px_-12px_rgba(124,58,237,0.7)]"
              : "bg-ink/20"
        }`}
      >
        {posted
          ? "Posted ✓"
          : itemizedShort
            ? "Assign every line first"
            : num > 0
              ? `Post $${num.toFixed(2)} to ${group.name}`
              : "Enter an amount"}
      </button>

      <Link to="/home" className="mt-3 block text-center text-xs font-semibold text-ink/45">
        Cancel
      </Link>

      {/* split sheet */}
      {splitOpen && !isWallet ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            aria-label="Close split options"
            onClick={() => setSplitOpen(false)}
            className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
          />
          <div className="glass card-in relative mx-auto max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] p-4 pb-6">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
            <div className="flex items-center gap-3">
              <h2 className="flex-1 font-display text-lg font-bold tracking-tight">Split between</h2>
              <button
                onClick={() => setSplitOpen(false)}
                aria-label="Close"
                className="press grid size-8 place-items-center rounded-full bg-white/55 text-ink/60 outline-1 -outline-offset-1 outline-black/5"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-[18px] bg-brand-soft/70 px-4 py-3 outline-1 -outline-offset-1 outline-brand/20">
              <span className="text-[11px] font-semibold uppercase tracking-normal text-brand">
                Total amount
              </span>
              <span className="num text-xl font-bold text-ink">${num.toFixed(2)}</span>
            </div>

            <p className="mt-4 text-[10px] font-semibold uppercase tracking-normal text-ink/45">
              Split method
            </p>
            <div className="mt-2 grid grid-cols-4 gap-1 rounded-full bg-white/55 p-1 outline-1 -outline-offset-1 outline-black/5">
              {splitMethods.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickMethod(s.id)}
                  className={`press flex items-center justify-center gap-1 rounded-full px-2 py-2 text-[11px] font-semibold transition-colors ${
                    split === s.id ? "bg-brand text-white" : "text-ink/55"
                  }`}
                >
                  <s.icon className="size-3.5" />
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
                Members · {includedIds.length} selected
              </p>
              <button
                onClick={() =>
                  setIncluded(
                    includedIds.length === members.length ? [] : members.map((m) => m.id),
                  )
                }
                className="press text-[11px] font-semibold text-brand"
              >
                {includedIds.length === members.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {members.map((m) => {
                const on = included.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleMember(m.id)}
                    className={`press flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-[11px] font-semibold transition-colors ${
                      on
                        ? "bg-brand-soft text-brand outline-1 -outline-offset-1 outline-brand/30"
                        : "bg-white/55 text-ink/45 outline-1 -outline-offset-1 outline-black/5"
                    }`}
                  >
                    <img
                      src={avatarSrc(m.avatarKey)}
                      alt=""
                      className={`size-6 rounded-full ${on ? "" : "opacity-50 grayscale"}`}
                    />
                    {m.name}
                    {on ? <Check className="size-3" /> : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
                Split details
              </p>
              <p
                className={`num text-[11px] font-bold ${overAllocated ? "text-money-out" : "text-money-in"}`}
              >
                {split === "percent"
                  ? `100% allocated`
                  : split === "shares"
                    ? `${includedIds.length} shares`
                    : `$${num.toFixed(2)} allocated`}
              </p>
            </div>

            <div className="mt-2 space-y-1.5">
              {members
                .filter((m) => included.includes(m.id))
                .map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2.5 rounded-[18px] bg-white/55 px-3 py-2 outline-1 -outline-offset-1 outline-black/5"
                  >
                    <img src={avatarSrc(m.avatarKey)} alt="" className="size-7 rounded-full" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink/80">
                      {m.name}
                    </span>
                    {split === "equal" ? null : (
                      <div className="flex items-center gap-1 rounded-xl bg-white/70 px-2 py-1 outline-1 -outline-offset-1 outline-black/5">
                        {split === "amount" ? (
                          <span className="num text-[11px] text-ink/45">$</span>
                        ) : null}
                        <input
                          value={displayValue(m.id)}
                          onChange={(e) => setSplitValue(m.id, e.target.value)}
                          inputMode="decimal"
                          aria-label={`${m.name} share`}
                          className={`num w-14 bg-transparent text-right text-[12px] font-semibold outline-none ${
                            touched.includes(m.id) ? "text-ink" : "text-ink/45"
                          }`}
                        />
                        {split === "percent" ? (
                          <span className="num text-[11px] text-ink/45">%</span>
                        ) : null}
                        {split === "shares" ? (
                          <span className="text-[10px] font-semibold text-ink/45">x</span>
                        ) : null}
                      </div>
                    )}
                    <span className="num w-16 text-right text-[13px] font-bold text-brand">
                      ${(shares[m.id] ?? 0).toFixed(2)}
                    </span>
                  </div>
                ))}
            </div>

            {overAllocated ? (
              <p className="mt-2 text-[11px] font-semibold text-money-out">
                That's more than the total — lower a value to rebalance.
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-ink/45">
                Untouched people auto-fill so it always adds up.
              </p>
            )}

            <button
              onClick={() => setSplitOpen(false)}
              disabled={includedIds.length === 0}
              className={`press mt-4 w-full rounded-[22px] py-3.5 text-sm font-bold text-white transition-all ${
                includedIds.length === 0
                  ? "bg-ink/20"
                  : "bg-brand shadow-[0_16px_36px_-12px_rgba(124,58,237,0.7)]"
              }`}
            >
              Confirm split
            </button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
