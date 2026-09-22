import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { BackHeader, meta } from "@/components/SubScreen";
import { useRefreshSnapshot } from "@/lib/divy-client";
import { joinGroup } from "@/lib/divy.functions";

export const Route = createFileRoute("/_authenticated/join/$code")({
  head: () => meta("Join a group", "Join a Divy It Up group with an invite code."),
  component: JoinByCode,
});

function JoinByCode() {
  const { code } = Route.useParams();
  const join = useServerFn(joinGroup);
  const refresh = useRefreshSnapshot();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await join({ data: { code: code.toUpperCase() } });
      if (!alive) return;
      if (!res.ok || !res.groupId) {
        setError(res.error ?? "That invite code didn't work.");
        return;
      }
      await refresh();
      navigate({ to: "/group/$groupId", params: { groupId: res.groupId } });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <AppShell>
      <BackHeader eyebrow="Invite" title={error ? "Couldn't join" : "Joining…"} to="/groups" />
      <div className="glass card-in mt-1 rounded-[28px] p-6 text-center">
        <p className="num text-lg font-bold tracking-[0.2em] text-brand">{code.toUpperCase()}</p>
        <p className="mt-3 text-[12px] text-ink/55">
          {error ?? "Adding you to the group — one second."}
        </p>
        {error ? (
          <Link
            to="/create-group"
            className="press mt-4 inline-flex rounded-[18px] bg-brand px-5 py-3 text-[12px] font-bold text-white"
          >
            Try another code
          </Link>
        ) : null}
      </div>
    </AppShell>
  );
}
