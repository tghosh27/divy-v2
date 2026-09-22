import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };

/** Camera sheet that reads a group's QR code and hands back the code inside it. */
export function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      const Ctor = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector })
        .BarcodeDetector;
      if (!Ctor) {
        setError("This device can't scan QR codes here — type the code instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        setError("Camera access was blocked — type the code instead.");
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const detector = new Ctor({ formats: ["qr_code"] });
      const tick = async () => {
        if (stopped || !videoRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          const raw = found[0]?.rawValue?.trim();
          if (raw) {
            const code = (raw.split("/").pop() || raw).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
            if (code) {
              onCode(code);
              return;
            }
          }
        } catch {
          /* keep scanning */
        }
        raf = requestAnimationFrame(() => void tick());
      };
      void tick();
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4">
      <div className="glass w-full max-w-[430px] rounded-[28px] p-4">
        <div className="flex items-center justify-between">
          <p className="font-display text-[15px] font-bold">Scan group QR</p>
          <button
            onClick={onClose}
            aria-label="Close scanner"
            className="press grid size-9 place-items-center rounded-full bg-white/70 text-ink/60"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3 aspect-square w-full overflow-hidden rounded-[22px] bg-ink/90">
          {error ? (
            <p className="flex h-full items-center justify-center px-8 text-center text-[12px] text-white/80">
              {error}
            </p>
          ) : (
            <video ref={videoRef} muted playsInline className="size-full object-cover" />
          )}
        </div>

        <p className="mt-3 text-center text-[11px] text-ink/50">
          Point the camera at the QR code on the group's invite.
        </p>
      </div>
    </div>
  );
}
