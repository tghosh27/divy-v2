import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { AlertTriangle, BellOff, CalendarClock, CircleDollarSign, Clock } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { BackHeader, meta } from "@/components/SubScreen";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { markNotificationsRead } from "@/lib/divy.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () => meta("Notifications", "Overdue settle-ups, cycle deadlines and payments that landed."),
  component: NotificationsScreen,
});

const tones = {
  urgent: { icon: AlertTriangle, wrap: "bg-money-out/12 text-money-out" },
  warn: { icon: Clock, wrap: "bg-brand-soft text-brand" },
  good: { icon: CircleDollarSign, wrap: "bg-money-in/12 text-money-in" },
  calm: { icon: CalendarClock, wrap: "bg-white/70 text-ink/55" },
};

function NotificationsScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const refresh = useRefreshSnapshot();
  const markRead = useServerFn(markNotificationsRead);
  const notifications = data.notifications;
  const unread = notifications.filter((n) => n.unread).length;
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current || unread === 0) return;
    didRun.current = true;
    void markRead().then(() => refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell>
      <BackHeader
        eyebrow={`${unread} unread`}
        title="Notifications"
        to="/home"
        right={
          <button
            aria-label="Notification settings"
            className="press grid size-10 place-items-center rounded-full bg-white/55 text-ink/60 outline-1 -outline-offset-1 outline-black/5"
          >
            <BellOff className="size-4" />
          </button>
        }
      />

      {notifications.length === 0 ? (
        <div className="glass card-in mt-5 rounded-[24px] p-6 text-center text-[12px] text-ink/55">
          You're all caught up.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {notifications.map((n, i) => {
            const t = tones[n.tone];
            const Icon = t.icon;
            return (
              <div
                key={n.id}
                className="glass card-in flex items-start gap-3 rounded-[22px] p-4"
                style={{ animationDelay: `${0.05 * (i + 1)}s` }}
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${t.wrap}`}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">{n.title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink/55">{n.body}</p>
                  <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink/40">
                    {n.when}
                  </p>
                </div>
                {n.unread ? <span className="mt-1 size-2 shrink-0 rounded-full bg-brand" /> : null}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => {
          void markRead().then(() => refresh());
        }}
        className="press mt-5 w-full rounded-[20px] bg-white/60 py-3 text-[12px] font-bold text-ink/65 outline-1 -outline-offset-1 outline-black/8"
      >
        Mark all as read
      </button>
    </AppShell>
  );
}
