import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Badge,
  Button,
  Field,
  Input,
  Textarea,
  Panel,
  Spinner,
  notify,
} from "@/components/portal/ui";
import {
  SUPPORTED_SOURCES,
  TRANSCRIPT_STATUS_LABEL,
  resolveMedia,
  transcriptionBlocker,
} from "@/lib/academy/media";
import {
  getTranscript,
  requestTranscription,
  syncTranscription,
  regenerateNotes,
  saveTranscriptEdits,
  saveSpeakerNames,
} from "@/lib/academy-media.functions";
import { TranscriptViewer, parseTimestampLabel } from "@/components/vantage/academy/transcript-viewer";
import { Sparkles, RefreshCw, Upload, Info } from "lucide-react";

export type OwnerType = "recording" | "library" | "lesson";

/* -------------------------------------------------------------------------- */
/* Media source field: paste a link or upload a file                          */
/* -------------------------------------------------------------------------- */

export function MediaSourceField({
  label = "Media link",
  value,
  onChange,
  folder,
  accept,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  folder: string;
  accept?: string;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const resolved = resolveMedia(value);
  const blocker = value ? transcriptionBlocker(value) : null;

  async function upload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("academy").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: signed, error: signErr } = await supabase.storage
        .from("academy")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("no url");
      onChange(signed.signedUrl);
      notify.success("File uploaded.");
    } catch {
      notify.error("Upload failed.", "Please try a smaller file or paste a link instead.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Field label={label} hint={hint ?? "Paste a Google Drive, Vimeo, Loom, Zoom recording, YouTube or direct file link — or upload a file."}>
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <span
            className="p-focus inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-3 text-[13px]"
            style={{ borderColor: "var(--p-border)", background: "var(--p-raised)", color: "var(--p-text-2)" }}
          >
            {uploading ? <Spinner /> : <Upload size={13} aria-hidden />}
            {uploading ? "Uploading…" : "Upload file"}
          </span>
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
          />
        </label>
        <Button variant="ghost" size="sm" onClick={() => setShowSources((v) => !v)}>
          <Info size={13} /> Supported sources
        </Button>
        {value && (
          <Badge tone={resolved.kind === "unknown" ? "amber" : "blue"}>
            {resolved.kind === "unknown" ? "Unrecognized link" : resolved.kind}
          </Badge>
        )}
      </div>
      {showSources && (
        <ul className="p-secondary space-y-1 rounded-[10px] p-3" style={{ background: "var(--p-hover)" }}>
          {SUPPORTED_SOURCES.map((s) => (
            <li key={s}>• {s}</li>
          ))}
        </ul>
      )}
      {value && blocker && <p className="p-muted leading-snug">{blocker}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Transcript + AI training notes                                             */
/* -------------------------------------------------------------------------- */

export function TranscriptPanel({
  ownerType,
  ownerId,
  sourceUrl,
}: {
  ownerType: OwnerType;
  ownerId: string;
  sourceUrl: string;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getTranscript);
  const requestFn = useServerFn(requestTranscription);
  const syncFn = useServerFn(syncTranscription);
  const regenFn = useServerFn(regenerateNotes);
  const saveFn = useServerFn(saveTranscriptEdits);

  const key = ["academy", "transcript", ownerType, ownerId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => getFn({ data: { owner_type: ownerType, owner_id: ownerId } }),
    refetchInterval: (query) => {
      const st = (query.state.data as any)?.transcript?.status;
      return st === "queued" || st === "processing" ? 8000 : false;
    },
  });
  const t = (q.data as any)?.transcript ?? null;
  const status: string = t?.status ?? "not_started";
  const notesStatus: string = t?.notes_status ?? "not_started";
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const blocker = sourceUrl ? transcriptionBlocker(sourceUrl) : "Add a media link first.";
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function run(name: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(name);
    try {
      await fn();
      refresh();
      notify.success(ok);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  // Poll the provider whenever a job is in flight.
  if ((status === "queued" || status === "processing") && !busy) {
    void syncFn({ data: { owner_type: ownerType, owner_id: ownerId } }).then(() => refresh()).catch(() => {});
  }

  const tone =
    status === "completed" ? "green" : status === "failed" ? "red" : status === "not_started" ? "neutral" : "amber";

  return (
    <Panel
      title="Transcript & AI training notes"
      description={TRANSCRIPT_STATUS_LABEL[status] ?? status}
      actions={<Badge tone={tone as any}>{status.replace("_", " ")}</Badge>}
    >
      <div className="space-y-3">
        {blocker && status === "not_started" && <p className="p-muted leading-snug">{blocker}</p>}

        {status === "not_started" && !blocker && (
          <p className="p-muted leading-snug">Transcription starts automatically when you save.</p>
        )}
        {(status === "queued" || status === "processing") && (
          <p className="p-muted leading-snug">Transcribing in the background — notes appear here automatically.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {(status === "failed" || advanced) && (
          <Button
            variant={status === "failed" ? "primary" : "secondary"}
            size="sm"
            disabled={!!blocker}
            loading={busy === "request"}
            onClick={() =>
              run(
                "request",
                () => requestFn({ data: { owner_type: ownerType, owner_id: ownerId, source_url: sourceUrl, force: status === "completed" || status === "failed" } }),
                "Transcription started. This runs in the background.",
              )
            }
          >
            <Sparkles size={13} /> {status === "failed" ? "Retry" : "Re-transcribe"}
          </Button>
          )}
          {!advanced && status !== "failed" && !blocker && (
            <Button variant="ghost" size="sm" onClick={() => setAdvanced(true)}>
              Advanced
            </Button>
          )}
          {(status === "queued" || status === "processing") && (
            <Button
              variant="secondary"
              size="sm"
              loading={busy === "sync"}
              onClick={() => run("sync", () => syncFn({ data: { owner_type: ownerType, owner_id: ownerId } }), "Checked for updates.")}
            >
              <RefreshCw size={13} /> Check status
            </Button>
          )}
          {status === "completed" && (
            <Button
              variant="secondary"
              size="sm"
              loading={busy === "notes"}
              onClick={() => run("notes", () => regenFn({ data: { owner_type: ownerType, owner_id: ownerId } }), "Training notes regenerated.")}
            >
              <Sparkles size={13} /> Regenerate notes
            </Button>
          )}
        </div>

        {t?.error && <p className="text-[12.5px]" style={{ color: "var(--p-red)" }}>{t.error}</p>}
        {t?.notes_error && <p className="text-[12.5px]" style={{ color: "var(--p-red)" }}>{t.notes_error}</p>}
        {notesStatus === "processing" && <p className="p-muted">Writing training notes…</p>}

        {t?.notes && <NotesPreview notes={t.notes} />}

        {t?.transcript_text && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="p-label">Transcript</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(t.transcript_text);
                    notify.success("Transcript copied.");
                  }}
                >
                  Copy
                </Button>
                {editing ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={busy === "save"}
                      onClick={() =>
                        run("save", async () => {
                          await saveFn({ data: { owner_type: ownerType, owner_id: ownerId, transcript_text: draft } });
                          setEditing(false);
                        }, "Transcript saved.")
                      }
                    >
                      Save
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => { setDraft(t.transcript_text); setEditing(true); }}>
                    Edit
                  </Button>
                )}
              </div>
            </div>
            {editing ? (
              <Textarea rows={12} value={draft} onChange={(e) => setDraft(e.target.value)} />
            ) : (
              <>
                <SpeakerNamesEditor t={t} ownerType={ownerType} ownerId={ownerId} onSaved={refresh} />
                <TranscriptViewer
                  segments={t.transcript_segments as any}
                  fallbackText={t.transcript_text}
                  speakerNames={(t.speaker_names ?? {}) as Record<string, string>}
                  maxHeight={260}
                />
              </>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

/** Rename diarized speakers so learners see real names. */
function SpeakerNamesEditor({
  t,
  ownerType,
  ownerId,
  onSaved,
}: {
  t: any;
  ownerType: OwnerType;
  ownerId: string;
  onSaved: () => void;
}) {
  const saveNamesFn = useServerFn(saveSpeakerNames);
  const keys: string[] = Array.from(
    new Set(((t?.transcript_segments ?? []) as any[]).map((s) => s?.speaker).filter(Boolean)),
  );
  const [names, setNames] = useState<Record<string, string>>((t?.speaker_names ?? {}) as Record<string, string>);
  const [saving, setSaving] = useState(false);
  if (keys.length === 0) return null;

  return (
    <div className="rounded-[10px] p-3" style={{ background: "var(--p-hover)" }}>
      <div className="p-label mb-2">Speaker names</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {keys.map((k) => (
          <Field key={k} label={k}>
            <Input
              value={names[k] ?? ""}
              placeholder={k}
              onChange={(e) => setNames((n) => ({ ...n, [k]: e.target.value }))}
            />
          </Field>
        ))}
      </div>
      <Button
        className="mt-2"
        variant="secondary"
        size="sm"
        loading={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await saveNamesFn({ data: { owner_type: ownerType, owner_id: ownerId, speaker_names: names } });
            notify.success("Speaker names saved.");
            onSaved();
          } catch (e) {
            notify.error(e instanceof Error ? e.message : "Couldn't save speaker names.");
          } finally {
            setSaving(false);
          }
        }}
      >
        Save names
      </Button>
    </div>
  );
}



export function NotesPreview({ notes, onSeek }: { notes: any; onSeek?: (ms: number) => void }) {
  const lists: [string, string[]][] = [
    ["Key takeaways", notes?.key_takeaways ?? []],
    ["Sales concepts", notes?.sales_concepts ?? []],
    ["Script examples", notes?.script_examples ?? []],
    ["Objections handled", notes?.objections ?? []],
    ["Action items", notes?.action_items ?? []],
  ];
  const moments: any[] = notes?.moments ?? [];
  return (
    <div className="space-y-3 rounded-[10px] p-3" style={{ background: "var(--p-hover)" }}>
      {notes?.summary && <p className="p-secondary leading-snug">{notes.summary}</p>}
      {lists
        .filter(([, items]) => items.length > 0)
        .map(([title, items]) => (
          <div key={title}>
            <div className="p-label mb-1">{title}</div>
            <ul className="space-y-1">
              {items.map((it, i) => (
                <li key={i} className="p-secondary leading-snug">• {it}</li>
              ))}
            </ul>
          </div>
        ))}
      {moments.length > 0 && (
        <div>
          <div className="p-label mb-1">Moments</div>
          <ul className="space-y-1">
            {moments.map((m, i) => {
              const ms = parseTimestampLabel(m.timestamp);
              return (
                <li key={i} className="p-secondary leading-snug">
                  {onSeek && ms != null ? (
                    <button
                      onClick={() => onSeek(ms)}
                      className="p-focus rounded-md px-1 font-mono text-[12.5px] tabular-nums transition hover:bg-[var(--p-raised)]"
                      style={{ color: "var(--p-gold)" }}
                      aria-label={`Jump to ${m.timestamp}`}
                    >
                      {m.timestamp}
                    </button>
                  ) : (
                    <span style={{ color: "var(--p-gold)" }}>{m.timestamp}</span>
                  )}{" "}
                  {m.title}
                  {m.detail ? ` — ${m.detail}` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

