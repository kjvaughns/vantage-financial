import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge, Button, Field, Input, SegmentedControl, notify } from "@/components/portal/ui";
import { PILLARS, scoreTone } from "@/lib/coach-scoring";
import { advanceReview, createCallReview } from "@/lib/coach.functions";

export const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  transcribing: "Transcribing",
  scoring: "Scoring",
  analyzing: "Scoring",
  done: "Scored",
  failed: "Failed",
};

export function ScoreRing({ value, size = 88, label = "Overall" }: { value: number | null; size?: number; label?: string }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const tone = value == null ? "var(--p-border)" : `var(--p-${scoreTone(pct, 100)})`;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--p-border)" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={6} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div className="absolute text-center">
        <div className="text-[22px] font-semibold leading-none tabular-nums">{value ?? "—"}</div>
        <div className="p-label mt-1 text-[10px]">{label}</div>
      </div>
    </div>
  );
}

export function PillarBars({ scores }: { scores: Record<string, number | { score: number | null; status?: string } | null> }) {
  return (
    <div className="space-y-2">
      {PILLARS.map((p) => {
        const raw = scores[p.key];
        const skipped = !!raw && typeof raw === "object" && raw.status === "not_attempted";
        const v = raw == null ? null : typeof raw === "number" ? raw : raw.score;
        return (
          <div key={p.key} className="flex items-center gap-3 text-[13px]">
            <span className="w-28 shrink-0 text-muted-foreground">{p.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--p-border)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${((v ?? 0) / 10) * 100}%`, background: v == null ? "transparent" : `var(--p-${scoreTone(v)})` }} />
            </div>
            <span className="w-10 text-right tabular-nums">{skipped ? <span className="text-[11px] text-muted-foreground">N/A</span> : v == null ? "—" : `${Math.round(v * 10) / 10}`}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "done" ? "green" : status === "failed" ? "red" : "amber";
  return <Badge tone={tone} dot={status !== "done" && status !== "failed"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

/** Keeps advancing a review while it's processing. */
export function useReviewPolling(id: string | undefined, status: string | undefined, onChange: () => void) {
  const advance = useServerFn(advanceReview);
  const last = useRef(status);
  useEffect(() => {
    if (!id || !status || status === "done" || status === "failed") return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await advance({ data: { id } });
        if (r.status !== last.current) {
          last.current = r.status;
          onChange();
        }
      } catch {
        /* next tick */
      }
      if (!stop) timer = setTimeout(tick, 5000);
    };
    let timer = setTimeout(tick, 500);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id, status]); // eslint-disable-line react-hooks/exhaustive-deps
}

export async function uploadRecording(file: File, folder: string): Promise<string> {
  if (file.size > 200 * 1024 * 1024) throw new Error("Recordings must be under 200 MB.");
  const ext = (file.name.split(".").pop() || "m4a").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("call-recordings").upload(path, file, { contentType: file.type || "audio/mpeg" });
  if (error) throw new Error(error.message);
  return path;
}

export function MediaPicker({ mode, setMode, file, setFile, link, setLink }: {
  mode: "upload" | "drive";
  setMode: (m: "upload" | "drive") => void;
  file: File | null;
  setFile: (f: File | null) => void;
  link: string;
  setLink: (s: string) => void;
}) {
  return (
    <div className="space-y-3">
      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[{ value: "upload", label: "Upload file" }, { value: "drive", label: "Google Drive link" }]}
      />
      {mode === "upload" ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-center text-[13px] hover:bg-muted/30">
          <Upload size={18} aria-hidden className="text-primary" />
          <span>{file ? file.name : "Choose an audio file (mp3, m4a, wav)"}</span>
          <span className="text-muted-foreground">Up to 200 MB</span>
          <input type="file" accept="audio/*,video/mp4,.m4a,.mp3,.wav" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      ) : (
        <Field label="Google Drive file link" hint="Share → General access → Anyone with the link (Viewer).">
          <div className="relative">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-8" type="url" placeholder="https://drive.google.com/file/d/.../view" value={link} onChange={(e) => setLink(e.target.value)} />
          </div>
        </Field>
      )}
    </div>
  );
}

export function SubmitCallForm({ onCreated }: { onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const create = useServerFn(createCallReview);
  const [title, setTitle] = useState("");
  const [callType, setCallType] = useState<"roleplay" | "live">("roleplay");
  const [mode, setMode] = useState<"upload" | "drive">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      let mediaPath: string | null = null;
      if (mode === "upload") {
        if (!file) throw new Error("Choose a recording first.");
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("Please sign in again.");
        mediaPath = await uploadRecording(file, data.user.id);
      }
      return create({ data: { title: title.trim() || (callType === "live" ? "Live call" : "Roleplay"), callType, mediaPath, mediaUrl: mode === "drive" ? link.trim() : null } });
    },
    onSuccess: (r) => {
      notify.success("Call submitted", "Your score will be ready in a few minutes.");
      qc.invalidateQueries({ queryKey: ["coach-mine"] });
      onCreated(r.id);
    },
    onError: (e: Error) => notify.error("Couldn't submit", e.message),
  });
  const ready = mode === "upload" ? !!file : /^https:\/\/(drive|docs)\.google\.com\//.test(link.trim());
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Call name"><Input placeholder="e.g. Tuesday roleplay, Mr. Smith" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} /></Field>
        <Field label="Type">
          <SegmentedControl value={callType} onChange={setCallType} options={[{ value: "roleplay", label: "Roleplay" }, { value: "live", label: "Live call" }]} />
        </Field>
      </div>
      <MediaPicker mode={mode} setMode={setMode} file={file} setFile={setFile} link={link} setLink={setLink} />
      <Button variant="primary" loading={m.isPending} disabled={!ready} onClick={() => m.mutate()}>Analyze my call</Button>
    </div>
  );
}
