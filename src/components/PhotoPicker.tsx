import { useRef, useState } from "react";
import { Camera, Check, ImagePlus, Images, Trash2 } from "lucide-react";

import { fileToPhotoKey, isPhotoUpload } from "@/lib/photo-input";

type Option = { key: string; label: string };

export function PhotoPicker({
  value,
  onChange,
  options,
  srcFor,
  shape = "square",
  label = "Photo",
  hint,
  defaultKey,
}: {
  value: string;
  onChange: (key: string) => void;
  options: readonly Option[];
  srcFor: (key: string | null | undefined) => string;
  shape?: "square" | "circle";
  label?: string;
  hint?: string;
  /** Key that means "no photo picked yet" — shows a Remove button when value differs. */
  defaultKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const uploaded = isPhotoUpload(value);
  const round = shape === "circle" ? "rounded-full" : "rounded-[16px]";

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await fileToPhotoKey(file));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not use that photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="text-[11px] font-semibold text-ink/50">{label}</span>
      <div className="mt-2 flex items-center gap-3">
        <img
          src={srcFor(value === defaultKey ? null : value)}
          alt={label}
          width={56}
          height={56}
          className={`size-14 shrink-0 object-cover outline-1 -outline-offset-1 outline-black/8 ${round}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-ink/55">
            {busy
              ? "Working on that photo…"
              : uploaded
                ? "Your photo is set."
                : (hint ?? "Using a default image.")}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="press inline-flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1.5 text-[11px] font-bold text-brand"
            >
              <ImagePlus className="size-3.5" />
              {open ? "Close" : uploaded ? "Change photo" : "Add a photo"}
            </button>
            {defaultKey !== undefined && value !== defaultKey ? (
              <button
                type="button"
                onClick={() => onChange(defaultKey)}
                className="press inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-[11px] font-bold text-ink/55 outline-1 -outline-offset-1 outline-black/8"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {open ? (
        <div className="mt-3 rounded-2xl bg-white/70 p-3 outline-1 -outline-offset-1 outline-black/8">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => libraryRef.current?.click()}
              className="press flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white py-2.5 text-[11px] font-bold text-ink outline-1 -outline-offset-1 outline-black/8"
            >
              <Images className="size-3.5 text-brand" />
              My photos
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="press flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white py-2.5 text-[11px] font-bold text-ink outline-1 -outline-offset-1 outline-black/8"
            >
              <Camera className="size-3.5 text-brand" />
              Take photo
            </button>
          </div>

          <input
            ref={libraryRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <p className="mt-3 text-[10px] font-semibold uppercase tracking-normal text-ink/45">
            Or pick a default
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  onChange(o.key);
                  setOpen(false);
                }}
                aria-label={o.label}
                className={`press relative shrink-0 p-0.5 ${round} ${
                  value === o.key ? "outline-2 outline-brand" : "outline-1 outline-black/8"
                }`}
              >
                <img
                  src={srcFor(o.key)}
                  alt={o.label}
                  width={56}
                  height={56}
                  className={`size-14 object-cover ${round}`}
                />
                {value === o.key ? (
                  <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-brand text-white">
                    <Check className="size-2.5" />
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {error ? <p className="mt-2 text-[11px] font-semibold text-money-out">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
