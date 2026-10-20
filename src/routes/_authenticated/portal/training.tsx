import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Lock } from "lucide-react";
import { PortalShell } from "@/components/vantage/portal-shell";
import { Badge, Button, EmptyState, Field, Input, PageBody, PageHeader, Panel, TextSkeleton, Textarea, notify } from "@/components/portal/ui";
import { STATE_LABEL, STATE_TONE } from "@/components/vantage/training-panel";
import { getMyTraining, submitHomework, type TrainingDay } from "@/lib/training.functions";
import { isGoogleDriveRecordingLink } from "@/lib/training-homework";

export const Route = createFileRoute("/_authenticated/portal/training")({
  head: () => ({
    meta: [{ title: "Training — Vantage Portal" }, { name: "description", content: "Complete Vantage's daily roleplay training and submit recording homework for review." }, { property: "og:title", content: "Training — Vantage Portal" }, { property: "og:description", content: "Daily roleplay training, recording homework and release call progress." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }],
  }),
  component: TrainingPage,
});

function embedUrl(url: string | null): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const loom = url.match(/loom\.com\/share\/([\w]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

function TrainingPage() {
  const fetchFn = useServerFn(getMyTraining);
  const q = useQuery({ queryKey: ["my-training"], queryFn: () => fetchFn() });
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="New Agent Release Track" description="Four days of reps, then your release call. Each day unlocks when the one before it is approved." />
        {q.isLoading ? (
          <Panel><TextSkeleton lines={5} /></Panel>
        ) : q.error ? (
          <Panel><EmptyState title="Couldn't load training" description={(q.error as Error).message} /></Panel>
        ) : !q.data!.unlocked ? (
          <Panel>
            <EmptyState
              title="Training unlocks after onboarding"
              description="Finish every onboarding step, including the Vantage Closer Course, and your training days will open here."
              action={<Link to="/portal/onboarding" className="text-primary underline">Go to onboarding</Link>}
            />
          </Panel>
        ) : (
          <div className="space-y-3">
            {q.data!.clearedAt && (
              <Panel><div className="flex items-center gap-2 text-[14px]"><Badge tone="green">Cleared to call</Badge> You passed your release call. Get on the phones.</div></Panel>
            )}
            {q.data!.track.map((entry) => {
              const current = openId ?? q.data!.track.find((e) => e.state !== "approved" && e.state !== "locked")?.day.id;
              return (
                <DayCard key={entry.day.id} entry={entry} open={current === entry.day.id} onToggle={() => setOpenId(current === entry.day.id ? "" : entry.day.id)} />
              );
            })}
          </div>
        )}
      </PageBody>
    </PortalShell>
  );
}

function DayCard({
  entry,
  open,
  onToggle,
}: {
  entry: { day: TrainingDay; state: keyof typeof STATE_LABEL; latest: any };
  open: boolean;
  onToggle: () => void;
}) {
  const { day, state, latest } = entry;
  const locked = state === "locked";
  return (
    <Panel
      title={
        <button type="button" onClick={locked ? undefined : onToggle} className="flex items-center gap-2 text-left" disabled={locked}>
          {locked ? <Lock size={14} aria-hidden /> : state === "approved" ? <Check size={14} aria-hidden /> : null}
          <span>{day.day_label ? `${day.day_label} · ` : ""}{day.title}</span>
        </button>
      }
      actions={<Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>}
    >
      {locked ? (
        <p className="text-[13px] text-muted-foreground">{day.is_release ? "Unlocks when Monday–Thursday are approved." : "Unlocks when the previous day is approved."}</p>
      ) : !open ? (
        <button type="button" onClick={onToggle} className="text-[13px] text-primary underline">Open</button>
      ) : (
        <DayBody day={day} state={state} latest={latest} />
      )}
    </Panel>
  );
}

function DayBody({ day, state, latest }: { day: TrainingDay; state: string; latest: any }) {
  const embed = embedUrl(day.video_url);
  const copy = async () => {
    await navigator.clipboard.writeText(day.prompt ?? "");
    notify.success("Prompt copied", "Open ChatGPT, turn on voice mode and paste it.");
  };
  return (
    <div className="space-y-4 text-[14px]">
      {embed ? (
        <div className="aspect-video w-full overflow-hidden rounded-md border border-border">
          <iframe src={embed} title={day.title} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      ) : day.video_url ? (
        <a href={day.video_url} target="_blank" rel="noreferrer" className="text-primary underline">Watch today's lesson</a>
      ) : null}
      {day.objective && <div><div className="p-label mb-1">Objective</div>{day.objective}</div>}
      {day.instructions && <div><div className="p-label mb-1">How to do it</div><p className="whitespace-pre-line">{day.instructions}</p></div>}
      {day.prompt && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="p-label">Roleplay prompt</span>
            <Button size="sm" variant="primary" onClick={copy}><Copy size={14} aria-hidden /> Copy prompt</Button>
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-[12.5px]">{day.prompt}</pre>
        </div>
      )}
      {day.checklist?.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">{day.checklist.map((c) => <li key={c}>{c}</li>)}</ul>
      )}
      {latest?.feedback && (
        <div className="rounded-md border border-border p-3"><div className="p-label mb-1">Trainer feedback</div>{latest.feedback}</div>
      )}
      {state === "approved" ? null : state === "submitted" ? (
        <p className="text-muted-foreground">{day.is_release ? "Release call requested — your trainer will reach out to schedule it." : "Submitted. Your trainer will review it soon."}</p>
      ) : (
        <SubmitForm day={day} />
      )}
    </div>
  );
}

function SubmitForm({ day }: { day: TrainingDay }) {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitHomework);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: () => submitFn({ data: { dayId: day.id, linkUrl: link.trim() || null, note: note.trim() || null } }),
    onSuccess: () => {
      notify.success(day.is_release ? "Release call requested" : "Homework submitted");
      qc.invalidateQueries({ queryKey: ["my-training"] });
    },
    onError: (e: Error) => notify.error("Couldn't submit", e.message),
  });

  if (day.is_release) {
    return (
      <div className="space-y-3">
        <Field label="Anything your trainer should know? (optional)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Button variant="primary" loading={m.isPending} onClick={() => m.mutate()}>Request my release call</Button>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="p-label">Submit your homework</div>
      <ol className="list-decimal space-y-2 pl-5 text-[13px]">
        <li>Copy today's prompt into ChatGPT and start the roleplay in voice mode.</li>
        <li>Use Voice Memos on a separate device to record the full roleplay. Make sure both your voice and ChatGPT's voice can be heard clearly.</li>
        <li>Upload the voice memo recording to Google Drive.</li>
        <li>In Google Drive, open Share, set General access to “Anyone with the link” and the role to “Viewer,” then copy the link.</li>
        <li>Paste that recording's shareable link below and submit it for today's review.</li>
      </ol>
      <Field label="Google Drive recording link" hint="Share the recording file, not a folder or ChatGPT conversation."><Input type="url" placeholder="https://drive.google.com/file/d/.../view" value={link} onChange={(e) => setLink(e.target.value)} /></Field>
      {link.trim() && !isGoogleDriveRecordingLink(link) && <p role="alert" className="text-[13px] text-destructive">Enter a Google Drive recording file's shareable link.</p>}
      <Field label="Note (optional)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <Button variant="primary" loading={m.isPending} disabled={!isGoogleDriveRecordingLink(link)} onClick={() => m.mutate()}>Submit for review</Button>
    </div>
  );
}
