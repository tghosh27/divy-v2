import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, Download, Receipt } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { BackHeader, meta } from "@/components/SubScreen";
import { snapshotQuery } from "@/lib/divy-client";
import type { PaymentRow } from "@/lib/divy-types";

export const Route = createFileRoute("/_authenticated/history")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () =>
    meta("Payment history", "Every payment you've made and received, ready to export."),
  component: HistoryScreen,
});

type Range = "30" | "90" | "all";

const RANGE_LABEL: Record<Range, string> = {
  "30": "Last 30 days",
  "90": "Last 90 days",
  all: "All time",
};

function csv(rows: PaymentRow[]) {
  const head = "Date,Description,Group,Method,Amount";
  const body = rows.map((r) =>
    [r.isoDate, r.label, r.group, r.method, r.amount.toFixed(2)]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [head, ...body].join("\n");
}

function HistoryScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const [range, setRange] = useState<Range>("30");
  const [saved, setSaved] = useState(false);

  const rows = useMemo(() => {
    if (range === "all") return data.paymentHistory;
    const days = Number(range);
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    return data.paymentHistory.filter((r) => r.isoDate >= cutoff);
  }, [data.paymentHistory, range]);

  const out = rows.filter((r) => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);
  const inn = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);

  const byMonth = useMemo(() => {
    const map = new Map<string, PaymentRow[]>();
    for (const r of rows) {
      const key = new Date(`${r.isoDate}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [rows]);

  function exportStatement() {
    const blob = new Blob([csv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `divy-statement-${RANGE_LABEL[range].toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <AppShell>
      <BackHeader eyebrow="Your money" title="Payment history" to="/profile" />

      <div className="mt-4 flex gap-1.5">
        {(["30", "90", "all"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`press flex-1 rounded-full py-2 text-[11px] font-bold transition-colors ${
              range === r
                ? "bg-brand text-white"
                : "bg-white/70 text-ink/55 outline-1 -outline-offset-1 outline-black/8"
            }`}
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>

      <div className="glass card-in mt-4 grid grid-cols-2 gap-3 rounded-[24px] p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">Paid out</p>
          <p className="num mt-1 text-[22px] font-bold text-money-out">${out.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
            Received
          </p>
          <p className="num mt-1 text-[22px] font-bold text-money-in">${inn.toFixed(2)}</p>
        </div>
      </div>

      <button
        onClick={exportStatement}
        disabled={!rows.length}
        className={`press mt-3 flex w-full items-center justify-center gap-1.5 rounded-[20px] py-3.5 text-[13px] font-bold text-white transition-all ${
          rows.length ? "bg-brand" : "bg-ink/20"
        }`}
      >
        {saved ? (
          "Statement saved ✓"
        ) : (
          <>
            <Download className="size-4" /> Export statement
          </>
        )}
      </button>
      <p className="mt-2 text-center text-[11px] text-ink/45">
        Saves a spreadsheet you can open in Excel, Numbers or Sheets.
      </p>

      {byMonth.length ? (
        byMonth.map(([month, list], i) => (
          <div
            key={month}
            className="glass card-in mt-4 rounded-[24px] px-4"
            style={{ animationDelay: `${0.04 * i}s` }}
          >
            <p className="py-3.5 text-[11px] font-semibold uppercase tracking-normal text-ink/45">
              {month}
            </p>
            <div className="divide-y divide-black/5 border-t border-black/5">
              {list.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-3.5">
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                      r.amount < 0 ? "bg-money-out/10 text-money-out" : "bg-money-in/10 text-money-in"
                    }`}
                  >
                    {r.amount < 0 ? (
                      <ArrowUpRight className="size-4" />
                    ) : (
                      <ArrowDownToLine className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.label}</p>
                    <p className="truncate text-[11px] text-ink/50">
                      {r.group} · {r.date} · {r.method}
                    </p>
                  </div>
                  <p
                    className={`num text-sm font-bold ${
                      r.amount < 0 ? "text-money-out" : "text-money-in"
                    }`}
                  >
                    {r.amount < 0 ? "-" : "+"}${Math.abs(r.amount).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="glass card-in mt-4 rounded-[24px] py-12 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Receipt className="size-5" />
          </span>
          <p className="mt-3 text-sm font-semibold">Nothing here yet</p>
          <p className="mt-1 text-[12px] text-ink/50">
            Payments show up here as soon as you settle up.
          </p>
        </div>
      )}
    </AppShell>
  );
}
