import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatTimestamp } from "@/lib/academy/media";

export type Segment = { start: number; end: number; text: string; speaker?: string | null };

export type SeekTarget =
  | { kind: "element"; ref: React.RefObject<HTMLMediaElement | null> }
  | { kind: "youtube"; ref: React.RefObject<HTMLIFrameElement | null> }
  | { kind: "vimeo"; ref: React.RefObject<HTMLIFrameElement | null> }
  | { kind: "none" };

/** Unified seek + current-time tracking for native media and YouTube / Vimeo embeds. */
export function useMediaSeek(target: SeekTarget) {
  const [currentMs, setCurrentMs] = useState(0);
  const canSeek = target.kind !== "none";

  // Native media: follow timeupdate.
  useEffect(() => {
    if (target.kind !== "element") return;
    const el = target.ref.current;
    if (!el) return;
    const onTime = () => setCurrentMs(Math.floor(el.currentTime * 1000));
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [target.kind, (target as any).ref?.current]);

  // Embeds: listen for player time messages.
  useEffect(() => {
    if (target.kind !== "youtube" && target.kind !== "vimeo") return;
    const iframe = target.ref.current;
    const onMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (target.kind === "vimeo" && data?.event === "timeupdate" && data?.data?.seconds != null) {
          setCurrentMs(Math.floor(Number(data.data.seconds) * 1000));
        }
        if (target.kind === "youtube" && data?.info?.currentTime != null) {
          setCurrentMs(Math.floor(Number(data.info.currentTime) * 1000));
        }
      } catch {
        /* not our message */
      }
    };
    window.addEventListener("message", onMessage);
    // Ask Vimeo to start sending time updates and YouTube to start its event stream.
    const t = setTimeout(() => {
      if (!iframe?.contentWindow) return;
      if (target.kind === "vimeo") {
        iframe.contentWindow.postMessage(JSON.stringify({ method: "addEventListener", value: "timeupdate" }), "*");
      } else {
        iframe.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*");
      }
    }, 1200);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(t);
    };
  }, [target.kind, (target as any).ref?.current]);

  const seek = useCallback(
    (ms: number) => {
      const seconds = Math.max(0, Math.floor(ms / 1000));
      if (target.kind === "element") {
        const el = target.ref.current;
        if (!el) return;
        el.currentTime = seconds;
        void el.play?.().catch(() => {});
        setCurrentMs(seconds * 1000);
        return;
      }
      const win = target.kind === "none" ? null : target.ref.current?.contentWindow;
      if (!win) return;
      if (target.kind === "youtube") {
        win.postMessage(JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }), "*");
        win.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
      } else if (target.kind === "vimeo") {
        win.postMessage(JSON.stringify({ method: "setCurrentTime", value: seconds }), "*");
        win.postMessage(JSON.stringify({ method: "play" }), "*");
      }
      setCurrentMs(seconds * 1000);
    },
    [target],
  );

  return { seek, canSeek, currentMs };
}

function displaySpeaker(raw: string | null | undefined, names: Record<string, string> | null | undefined) {
  if (!raw) return null;
  return names?.[raw] || raw;
}

/** Speaker-grouped, timestamped transcript. Clicking a line jumps the player. */
export function TranscriptViewer({
  segments,
  fallbackText,
  speakerNames,
  onSeek,
  canSeek = false,
  currentMs = 0,
  maxHeight = 520,
  fixedHeight,
}: {
  segments?: Segment[] | null;
  fallbackText?: string | null;
  speakerNames?: Record<string, string> | null;
  onSeek?: (ms: number) => void;
  canSeek?: boolean;
  currentMs?: number;
  maxHeight?: number;
  /** Fixed box height (px); enables follow-along auto-scroll with manual-scroll pause. */
  fixedHeight?: number;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const userScrollAt = useRef(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!paused) return;
    const t = setTimeout(() => setPaused(false), 5000);
    return () => clearTimeout(t);
  }, [paused, currentMs > 0 && Math.floor(currentMs / 5000)]);
  const markUser = () => { userScrollAt.current = Date.now(); setPaused(true); };
  const list = useMemo(() => (Array.isArray(segments) ? segments.filter((s) => s && s.text) : []), [segments]);

  // Group consecutive segments by speaker.
  const blocks = useMemo(() => {
    const out: { speaker: string | null; start: number; lines: Segment[] }[] = [];
    for (const seg of list) {
      const last = out[out.length - 1];
      if (last && (last.speaker ?? null) === (seg.speaker ?? null)) last.lines.push(seg);
      else out.push({ speaker: seg.speaker ?? null, start: seg.start, lines: [seg] });
    }
    return out;
  }, [list]);

  let activeIdx = -1;
  for (let i = 0; i < list.length; i++) {
    if (list[i].start <= currentMs) activeIdx = i;
    else break;
  }
  const activeStart = activeIdx >= 0 ? list[activeIdx].start : -1;

  useEffect(() => {
    const c = scrollRef.current;
    if (!c || activeStart < 0 || paused) return;
    const el = c.querySelector("[data-active='true']") as HTMLElement | null;
    if (!el) return;
    const cRect = c.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const top = c.scrollTop + (eRect.top - cRect.top) - c.clientHeight / 2 + eRect.height / 2;
    c.scrollTo({ top, behavior: "smooth" });
  }, [activeStart, paused]);

  if (!list.length) {
    if (!fallbackText) return <p className="p-muted leading-snug">No transcript for this recording yet.</p>;
    return (
      <div
        className="p-secondary overflow-y-auto whitespace-pre-wrap rounded-[10px] p-3 leading-relaxed"
        style={{ background: "var(--p-hover)", maxHeight }}
      >
        {fallbackText}
      </div>
    );
  }

  const hasSpeakers = blocks.some((b) => !!b.speaker);

  return (
    <div className="space-y-2">
      <div className="p-muted">
        {canSeek ? "Click any timestamp to jump the player to that moment." : "Timestamps show where each line happens."}
        {hasSpeakers ? " Lines are grouped by speaker." : ""}
      </div>
      <div className="relative">
      <div
        ref={scrollRef}
        onWheel={markUser}
        onTouchMove={markUser}
        className="flex flex-col gap-3 overflow-y-auto rounded-[10px] p-3"
        style={{ background: "var(--p-hover)", ...(fixedHeight ? { height: fixedHeight } : { maxHeight }) }}
      >
        {blocks.map((b, bi) => (
          <div key={bi} className="flex flex-col gap-1">
            {b.speaker && (
              <div
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--p-gold)" }}
              >
                {displaySpeaker(b.speaker, speakerNames)}
              </div>
            )}
            {b.lines.map((seg, i) => {
              const on = seg.start === activeStart;
              return (
                <div key={i} data-active={on ? "true" : "false"} className="flex items-start gap-2.5">
                  {canSeek ? (
                    <button
                      onClick={() => onSeek?.(seg.start)}
                      className="p-focus mt-[1px] shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[12px] tabular-nums transition hover:bg-[var(--p-raised)]"
                      style={{ color: on ? "var(--p-gold)" : "var(--p-text-3)", fontWeight: on ? 600 : 400 }}
                      aria-label={`Jump to ${formatTimestamp(seg.start)}`}
                    >
                      {formatTimestamp(seg.start)}
                    </button>
                  ) : (
                    <span
                      className="mt-[1px] shrink-0 px-1.5 py-0.5 font-mono text-[12px] tabular-nums"
                      style={{ color: "var(--p-text-3)" }}
                      title="This player doesn't support jumping to a timestamp."
                    >
                      {formatTimestamp(seg.start)}
                    </span>
                  )}
                  <p
                    className="text-[13.5px] leading-relaxed"
                    style={{ color: on ? "var(--p-text)" : "var(--p-text-2)" }}
                  >
                    {seg.text}
                  </p>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {paused && currentMs > 0 && (
        <button
          type="button"
          onClick={() => setPaused(false)}
          className="p-focus absolute bottom-2 right-3 rounded-full px-3 py-1 text-[12px] font-semibold shadow"
          style={{ background: "var(--p-gold)", color: "var(--p-bg)" }}
        >
          Back to live
        </button>
      )}
      </div>
    </div>
  );
}

/** Parse an "mm:ss" / "h:mm:ss" label from AI notes into milliseconds. */
export function parseTimestampLabel(label?: string | null): number | null {
  if (!label) return null;
  const m = String(label).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, h, mm, ss] = m;
  return ((Number(h ?? 0) * 3600 + Number(mm) * 60 + Number(ss)) * 1000) | 0;
}
