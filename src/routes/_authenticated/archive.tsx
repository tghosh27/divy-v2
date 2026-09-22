import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Archive, RotateCcw, Trash2 } from "lucide-react";

import { AppShell, money } from "@/components/AppShell";
import { BackHeader, meta } from "@/components/SubScreen";
import { coverSrc } from "@/lib/divy-assets";
import { snapshotQuery, useRefreshSnapshot } from "@/lib/divy-client";
import { deleteGroup, setGroupArchived } from "@/lib/divy.functions";

export const Route = createFileRoute("/_authenticated/archive")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () =>
    meta("Archived groups", "Finished groups you've tucked away — view, restore or delete them."),
  component: ArchiveScreen,
});

function ArchiveScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const restore = useServerFn(setGroupArchived);
  const remove = useServerFn(deleteGroup);
  const refresh = useRefreshSnapshot();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const archived = data.groups.filter((g) => g.archived);

  async function handleRestore(groupId: string) {
    await restore({ data: { groupId, archived: false } });
    await refresh();
  }

  async function handleDelete(groupId: string) {
    await remove({ data: { groupId } });
    setConfirmId(null);
    await refresh();
  }

  return (
    <AppShell>
      <BackHeader eyebrow="Groups" title="Archived" to="/groups" />

      {archived.length === 0 ? (
        <div className="glass card-in mt-5 rounded-[24px] p-6 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-brand-soft">
            <Archive className="size-4.5 text-brand" />
          </div>
          <p className="mt-3 text-sm font-semibold">Nothing archived yet</p>
          <p className="mt-1 text-[12px] text-ink/55">
            When a group is finished and everyone's settled up, archive it from the group's Cycle
            tab. It stays here for the history.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {archived.map((g, i) => (
            <div
              key={g.id}
              className="glass card-in rounded-[24px] p-4"
              style={{ animationDelay: `${0.06 * (i + 1)}s` }}
            >
              <Link to="/group/$groupId" params={{ groupId: g.id }} className="press block">
                <div className="flex items-center gap-3">
                  <img
                    src={coverSrc(g.coverKey)}
                    alt={g.name}
                    loading="lazy"
                    className="shrink-0 rounded-2xl object-cover grayscale"
                    style={{ width: 46, height: 46 }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{g.name}</p>
                    <p className="mt-0.5 text-[11px] text-ink/50">
                      {g.members} members · {g.lastActivity}
                    </p>
                  </div>
                  <span className="num shrink-0 text-[13px] font-bold text-ink/60">
                    {g.balance === 0 ? "All even" : money(g.balance)}
                  </span>
                </div>
              </Link>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleRestore(g.id)}
                  className="press flex flex-1 items-center justify-center gap-1.5 rounded-[16px] bg-white py-2.5 text-[12px] font-bold text-brand outline-1 -outline-offset-1 outline-brand/25"
                >
                  <RotateCcw className="size-3.5" /> Restore
                </button>
                <button
                  onClick={() => setConfirmId(confirmId === g.id ? null : g.id)}
                  className="press flex items-center justify-center gap-1.5 rounded-[16px] bg-white px-3.5 py-2.5 text-[12px] font-bold text-money-out outline-1 -outline-offset-1 outline-money-out/25"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>

              {confirmId === g.id ? (
                <div className="mt-2 rounded-2xl bg-money-out/8 p-3">
                  <p className="text-[11px] font-semibold text-money-out">
                    Delete {g.name} for good? The expenses and history go with it.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="press flex-1 rounded-[14px] bg-money-out py-2 text-[12px] font-bold text-white"
                    >
                      Delete forever
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="press rounded-[14px] bg-white px-3.5 py-2 text-[12px] font-bold text-ink outline-1 -outline-offset-1 outline-black/8"
                    >
                      Keep it
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
