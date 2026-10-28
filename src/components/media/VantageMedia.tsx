/**
 * Universal Vantage media player: one player for every audio/video recording
 * (Academy, Call Coach, Training) with a synced, auto-scrolling transcript
 * underneath. Drive links are copied into Vantage storage on first play.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AudioLines, ExternalLink, Loader2, Maximize, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { resolveMedia } from "@/lib/academy/media";
import { ensureAcademyMediaCached } from "@/lib/media-cache.functions";
import { TranscriptViewer, useMediaSeek, type Segment } from "@/components/vantage/academy/transcript-viewer";

export type VantageMediaHandle = { seek: (ms: number) => void };

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};
const SPEEDS = [1, 1.25, 1.5, 1.75, 2];

type Props = {
  /** Original saved link (Drive, YouTube, Vimeo, Loom, direct file). */
  url?: string | null;
  /** Already-playable URL (e.g. a signed storage URL); skips resolution. */
  directSrc?: string | null;
  kind?: "audio" | "video";
  title?: string;
  segments?: Segment[] | null;
  fallbackText?: string | null;
  speakerNames?: Record<string, string> | null;
  /** Hide the transcript box (e.g. when the page shows it elsewhere). */
  hideTranscript?: boolean;
  transcriptHeight?: number;
  onTime?: (ms: number) => void;
};

export const VantageMedia = forwardRef<VantageMediaHandle, Props>(function VantageMedia(
  { url, directSrc, kind = "video", title, segments, fallbackText, speakerNames, hideTranscript, transcriptHeight = 280, onTime },
  ref,
) {
  const media = resolveMedia(directSrc ? null : url);
  const cacheFn = useServerFn(ensureAcademyMediaCached);
  const needsCache = !directSrc && media.kind === "drive" && !!url;
  const cache = useQuery({
    queryKey: ["media-cache", url, kind],
    queryFn: () => cacheFn({ data: { url: url!, kind } }),
    enabled: needsCache,
    staleTime: 5 * 60 * 60 * 1000,
    retry: false,
  });

  // Files too large to copy into storage stream straight from Drive into the
  // Vantage player (Drive supports byte ranges); the Drive embed is only a last resort.
  const [streamFailed, setStreamFailed] = useState(false);
  const driveId = media.kind === "drive" ? media.fetchUrl?.match(/id=([\w-]+)/)?.[1] ?? null : null;
  const driveStream = needsCache && cache.isFetched && !cache.data?.url && driveId && !streamFailed
    ? `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`
    : null;
  const nativeSrc = directSrc ?? (needsCache ? cache.data?.url ?? driveStream : media.kind === "direct" || media.kind === "unknown" ? media.playbackUrl : null);
  const embedUrl = !nativeSrc && !(needsCache && cache.isLoading) ? media.embedUrl : null;

  const el = useRef<HTMLMediaElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [nativeMs, setNativeMs] = useState(0);
  const embedTarget =
    embedUrl && media.kind === "youtube" ? ({ kind: "youtube", ref: frameRef } as const)
    : embedUrl && media.kind === "vimeo" ? ({ kind: "vimeo", ref: frameRef } as const)
    : ({ kind: "none" } as const);
  const embed = useMediaSeek(embedTarget);

  const currentMs = nativeSrc ? nativeMs : embed.currentMs;
  const canSeek = !!nativeSrc || embed.canSeek;
  const seek = (ms: number) => {
    if (nativeSrc && el.current) {
      el.current.currentTime = ms / 1000;
      void el.current.play().catch(() => {});
    } else embed.seek(ms);
  };
  useImperativeHandle(ref, () => ({ seek }));
  useEffect(() => { onTime?.(currentMs); }, [currentMs]);

  let player: React.ReactNode;
  if (!url && !directSrc) {
    player = <Empty>{kind === "audio" ? "No audio attached yet." : "No video attached yet."}</Empty>;
  } else if (needsCache && cache.isLoading) {
    player = (
      <Empty>
        <Loader2 size={16} className="mr-2 animate-spin" /> Preparing recording…
      </Empty>
    );
  } else if (nativeSrc) {
    player = <NativePlayer src={nativeSrc} kind={kind} elRef={el} onMs={setNativeMs} title={title} onError={nativeSrc === driveStream ? () => setStreamFailed(true) : undefined} />;
  } else if (embedUrl) {
    player = (
      <div className="space-y-1">
        <iframe
          ref={frameRef}
          src={embedUrl}
          title={title ?? "Recording"}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          className={kind === "audio" && media.kind === "drive" ? "h-[120px] w-full rounded-lg" : "aspect-video w-full rounded-lg"}
          style={{ border: 0, background: "var(--p-raised)" }}
        />
        {media.kind === "drive" && (
          <p className="text-[11.5px]" style={{ color: "var(--p-text-3)" }}>
            Playing from Google Drive. Share the file as "Anyone with the link" so it loads in the Vantage player.{" "}
            <a href={url!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: "var(--p-gold)" }}>
              Open <ExternalLink size={11} />
            </a>
          </p>
        )}
      </div>
    );
  } else {
    player = (
      <Empty>
        <a href={url!} target="_blank" rel="noreferrer" style={{ color: "var(--p-gold)" }}>Open recording</a>
      </Empty>
    );
  }

  const hasTranscript = (Array.isArray(segments) && segments.length > 0) || !!fallbackText;
  return (
    <div className="space-y-3">
      {player}
      {!hideTranscript && hasTranscript && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--p-text-3)" }}>Transcript</div>
          <TranscriptViewer
            segments={segments}
            fallbackText={fallbackText}
            speakerNames={speakerNames}
            onSeek={seek}
            canSeek={canSeek}
            currentMs={currentMs}
            fixedHeight={transcriptHeight}
          />
        </div>
      )}
    </div>
  );
});

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[96px] items-center justify-center rounded-lg text-[13px]" style={{ background: "var(--p-raised)", color: "var(--p-text-3)" }}>
      {children}
    </div>
  );
}

function NativePlayer({
  src, kind, elRef, onMs, title, onError,
}: { src: string; kind: "audio" | "video"; elRef: React.MutableRefObject<HTMLMediaElement | null>; onMs: (ms: number) => void; title?: string; onError?: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  // Files labelled "video" can still be audio-only (e.g. an MP3 mislabelled in
  // the admin). Drop the video frame whenever the media has no video track.
  const [audioOnly, setAudioOnly] = useState(false);

  const common = {
    src,
    preload: "metadata" as const,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onWaiting: () => setLoading(true),
    onError: () => onError?.(),
    onCanPlay: () => setLoading(false),
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      setDur(e.currentTarget.duration); setLoading(false);
      const v = e.currentTarget as HTMLVideoElement;
      if (kind === "video" && typeof v.videoWidth === "number" && v.videoWidth === 0) setAudioOnly(true);
    },
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => { setT(e.currentTarget.currentTime); onMs(Math.floor(e.currentTarget.currentTime * 1000)); },
  };
  const a = () => elRef.current;
  const toggle = () => (a()?.paused ? void a()?.play() : a()?.pause());
  const skip = (d: number) => { const m = a(); if (m) m.currentTime = Math.max(0, Math.min(m.duration || Infinity, m.currentTime + d)); };
  const cycle = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (a()) a()!.playbackRate = next;
  };
  const fullscreen = () => { void wrap.current?.requestFullscreen?.(); };

  return (
    <div ref={wrap} className="overflow-hidden rounded-lg" style={{ background: "var(--p-raised)", border: "1px solid var(--p-border)" }}>
      {kind === "video" ? (
        <video
          ref={elRef as React.Ref<HTMLVideoElement>}
          {...common}
          playsInline
          onClick={toggle}
          className={audioOnly ? "hidden" : "aspect-video w-full cursor-pointer bg-background"}
        />
      ) : (
        <audio ref={elRef as React.Ref<HTMLAudioElement>} {...common} />
      )}
      {audioOnly && (
        <div className="flex items-center gap-2 px-3 pt-3" style={{ color: "var(--p-text-2)" }}>
          <AudioLines size={16} style={{ color: "var(--p-gold)" }} />
          <span className="truncate text-[12.5px]">{title ?? "Audio recording"}</span>
        </div>
      )}
      <div className="p-3">
        <input
          type="range" min={0} max={dur || 0} step={0.1} value={t} aria-label="Seek"
          onChange={(e) => { if (a()) a()!.currentTime = Number(e.target.value); }}
          className="w-full accent-primary"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="w-28 text-[12px] tabular-nums" style={{ color: "var(--p-text-3)" }}>{fmt(t)} / {fmt(dur)}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => skip(-15)} aria-label="Back 15 seconds" className="p-focus rounded-full p-2 hover:bg-[var(--p-hover)]"><RotateCcw size={16} /></button>
            <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="p-focus flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {loading && playing ? <Loader2 size={18} className="animate-spin" /> : playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>
            <button type="button" onClick={() => skip(15)} aria-label="Forward 15 seconds" className="p-focus rounded-full p-2 hover:bg-[var(--p-hover)]"><RotateCw size={16} /></button>
          </div>
          <div className="flex w-28 items-center justify-end gap-1">
            <button type="button" onClick={cycle} aria-label="Playback speed" className="p-focus rounded-md px-2 py-1 text-[12px] font-semibold tabular-nums hover:bg-[var(--p-hover)]">{speed}x</button>
            {kind === "video" && !audioOnly && (
              <button type="button" onClick={fullscreen} aria-label="Full screen" className="p-focus rounded-md p-1.5 hover:bg-[var(--p-hover)]"><Maximize size={15} /></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
