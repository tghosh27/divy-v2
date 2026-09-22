import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BookUser, Check, Copy, MessageSquare, Share2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { BackHeader, meta } from "@/components/SubScreen";
import { snapshotQuery } from "@/lib/divy-client";

export const Route = createFileRoute("/_authenticated/invite/$groupId")({
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotQuery),
  head: () => meta("Invite people", "Share a link or QR code so friends can join your group."),
  component: InviteScreen,
});

function InviteScreen() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(snapshotQuery);
  const detail = data.groupDetails[params.groupId];
  if (!detail) throw notFound();

  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const origin = typeof window === "undefined" ? "https://www.divyitup.com" : window.location.origin;
  const link = `${origin}/join/${detail.joinCode}`;
  const message = `Join ${detail.name} on Divy It Up so we can split expenses: ${link}`;

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(link, {
      width: 520,
      margin: 1,
      color: { dark: "#241a3d", light: "#ffffff" },
    })
      .then((url) => {
        if (alive) setQr(url);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [link]);

  async function copy(value: string, which: "link" | "code") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setNote("Couldn't copy here — press and hold the text to copy it.");
    }
  }

  async function share() {
    setNote(null);
    const nav = navigator as Navigator & { share?: (d: { text: string; url?: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ text: message, url: link });
        return;
      } catch {
        return;
      }
    }
    await copy(message, "link");
  }

  function textInvite() {
    setNote(null);
    window.location.href = `sms:?&body=${encodeURIComponent(message)}`;
  }

  async function pickContacts() {
    setNote(null);
    const nav = navigator as Navigator & {
      contacts?: { select: (props: string[], opts: { multiple: boolean }) => Promise<unknown[]> };
    };
    if (!nav.contacts) {
      setNote("Your phone won't share contacts here — send a text invite instead.");
      return;
    }
    try {
      const picked = await nav.contacts.select(["name", "tel"], { multiple: true });
      setNote(
        picked.length
          ? `${picked.length} contact${picked.length === 1 ? "" : "s"} picked — send them the text invite.`
          : "No contacts picked.",
      );
    } catch {
      setNote("Contacts weren't shared. You can still send a text invite.");
    }
  }

  return (
    <AppShell>
      <BackHeader eyebrow="Invite people" title={detail.name} to={`/group/${detail.id}`} />

      <div className="glass card-in mt-1 rounded-[28px] p-5 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-normal text-ink/45">
          Scan to join
        </p>
        <div className="mx-auto mt-4 grid size-[190px] place-items-center rounded-[24px] bg-white p-3 outline-1 -outline-offset-1 outline-black/8">
          {qr ? (
            <img src={qr} alt={`QR code to join ${detail.name}`} className="size-full" />
          ) : (
            <span className="text-[11px] text-ink/40">Making your code…</span>
          )}
        </div>
        <p className="mt-4 text-[11px] text-ink/50">Group code</p>
        <button
          onClick={() => copy(detail.joinCode, "code")}
          className="press num mt-1 inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-lg font-bold tracking-[0.2em] text-brand"
        >
          {detail.joinCode}
          {copied === "code" ? <Check className="size-4" /> : <Copy className="size-3.5" />}
        </button>
      </div>

      <div className="glass card-in mt-3 rounded-[24px] p-4" style={{ animationDelay: "0.04s" }}>
        <p className="text-sm font-semibold">Invite link</p>
        <p className="mt-1 truncate text-[11px] text-ink/50">{link}</p>
        <button
          onClick={() => copy(link, "link")}
          className="press mt-3 flex w-full items-center justify-center gap-1.5 rounded-[18px] bg-brand py-3 text-[12px] font-bold text-white"
        >
          {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            onClick={share}
            className="press flex flex-col items-center gap-1 rounded-[18px] bg-white py-3 text-[11px] font-bold text-ink outline-1 -outline-offset-1 outline-black/8"
          >
            <Share2 className="size-4 text-brand" /> Share
          </button>
          <button
            onClick={textInvite}
            className="press flex flex-col items-center gap-1 rounded-[18px] bg-white py-3 text-[11px] font-bold text-ink outline-1 -outline-offset-1 outline-black/8"
          >
            <MessageSquare className="size-4 text-brand" /> Text
          </button>
          <button
            onClick={pickContacts}
            className="press flex flex-col items-center gap-1 rounded-[18px] bg-white py-3 text-[11px] font-bold text-ink outline-1 -outline-offset-1 outline-black/8"
          >
            <BookUser className="size-4 text-brand" /> Contacts
          </button>
        </div>
        {note ? <p className="mt-2 text-center text-[11px] text-ink/55">{note}</p> : null}
      </div>

      <p className="mt-3 px-2 text-center text-[11px] text-ink/45">
        Anyone with the code or link can join {detail.name}. Share it only with people you want in the
        group.
      </p>
    </AppShell>
  );
}
