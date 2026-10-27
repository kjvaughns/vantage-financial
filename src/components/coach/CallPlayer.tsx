import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ExternalLink, Pause, Play, RotateCcw, RotateCw } from "lucide-react";

export type CallPlayerHandle = { seek: (ms: number) => void };

const fmt = (s: number) => {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};
const SPEEDS = [1, 1.25, 1.5, 2];

export const CallPlayer = forwardRef<CallPlayerHandle, { src: string | null; driveFileId: string | null; onTime?: (ms: number) => void }>(
  function CallPlayer({ src, driveFileId, onTime }, ref) {
    const a = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [t, setT] = useState(0);
    const [dur, setDur] = useState(0);
    const [speed, setSpeed] = useState(1);
    useImperativeHandle(ref, () => ({
      seek: (ms) => { if (a.current) { a.current.currentTime = ms / 1000; void a.current.play(); } },
    }));

    if (!src && driveFileId) {
      return (
        <div className="w-full space-y-2">
          <iframe title="Call recording" src={`https://drive.google.com/file/d/${driveFileId}/preview`} className="h-[90px] w-full rounded-md border border-border bg-muted" allow="autoplay" />
          <a href={`https://drive.google.com/file/d/${driveFileId}/view`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline">
            <ExternalLink size={12} aria-hidden /> Open in Drive
          </a>
        </div>
      );
    }
    if (!src) return <p className="text-[12px] text-muted-foreground">No recording available for playback.</p>;

    const toggle = () => (a.current?.paused ? a.current.play() : a.current?.pause());
    const skip = (d: number) => { if (a.current) a.current.currentTime = Math.max(0, a.current.currentTime + d); };
    return (
      <div className="w-full rounded-lg border border-border bg-muted/30 p-3">
        <audio
          ref={a}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
          onTimeUpdate={(e) => { setT(e.currentTarget.currentTime); onTime?.(e.currentTarget.currentTime * 1000); }}
        />
        <input
          type="range" min={0} max={dur || 0} step={0.1} value={t} aria-label="Seek"
          onChange={(e) => { if (a.current) a.current.currentTime = Number(e.target.value); }}
          className="w-full accent-primary"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="w-20 text-left text-[12px] tabular-nums text-muted-foreground">{fmt(t)} / {fmt(dur)}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => skip(-15)} aria-label="Back 15 seconds" className="rounded-full p-2 hover:bg-muted"><RotateCcw size={16} /></button>
            <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>
            <button type="button" onClick={() => skip(15)} aria-label="Forward 15 seconds" className="rounded-full p-2 hover:bg-muted"><RotateCw size={16} /></button>
          </div>
          <button
            type="button" aria-label="Playback speed"
            onClick={() => { const n = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; setSpeed(n); if (a.current) a.current.playbackRate = n; }}
            className="w-20 text-right text-[12px] font-semibold text-primary"
          >{speed}x</button>
        </div>
      </div>
    );
  },
);
