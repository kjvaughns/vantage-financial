import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { markVslWatched } from "@/lib/applications.functions";
import { VslPlayer } from "./vsl-player";

/** Top-of-page "watch before your 1:1" block for the success pages. */
export function VslRequired({ token }: { token: string }) {
  const mark = useServerFn(markVslWatched);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mb-12 text-left">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-center">
        <span className="rounded-full bg-vantage-gold px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-vantage-card">
          Required before your 1:1
        </span>
        <span className="text-[14px] text-vantage-muted">Watch this first — it answers most questions.</span>
      </div>
      <VslPlayer />
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          disabled={done || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await mark({ data: { token } });
              setDone(true);
            } finally {
              setBusy(false);
            }
          }}
          className={`rounded-[8px] border px-5 py-2.5 text-[14px] font-semibold transition ${
            done
              ? "border-vantage-gold bg-vantage-gold/15 text-vantage-gold"
              : "border-vantage-gold/50 text-vantage-ivory hover:bg-vantage-gold/10"
          }`}
        >
          {done ? "✓ Thanks — you're ready for your call" : busy ? "Saving…" : "I've watched it"}
        </button>
      </div>
    </div>
  );
}
