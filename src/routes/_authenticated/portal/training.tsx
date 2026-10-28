import { getMe } from "@/lib/portal.functions";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronRight, Copy, Lock, Mic, Users } from "lucide-react";
import { PortalShell } from "@/components/vantage/portal-shell";
import { Badge, Button, EmptyState, Field, Input, PageBody, Panel, TextSkeleton, Textarea, btnClass, notify } from "@/components/portal/ui";
import { STATE_LABEL, STATE_TONE } from "@/components/vantage/training-panel";
import { getMyTraining, submitHomework, type TrainingDay } from "@/lib/training.functions";
import { isGoogleDriveRecordingLink } from "@/lib/training-homework";
import { VantageMedia } from "@/components/media/VantageMedia";
import { NewContentBadge } from "@/components/vantage/new-content-badge";
import { PillarBars, ScoreRing, StatusBadge, SubmitCallForm, useReviewPolling } from "@/components/vantage/coach";
import { listMyReviews } from "@/lib/coach.functions";
import { PILLARS, scoreTone } from "@/lib/coach-scoring";

/** Call Coach lives inside the Training Hub as its own tab. */
function CoachTab() {
  const navigate = useNavigate();
  const fn = useServerFn(listMyReviews);
  const q = useQuery({
    queryKey: ["coach-mine"],
    queryFn: () => fn(),
    refetchInterval: (qq) => ((qq.state.data?.reviews ?? []).some((r: any) => r.status !== "done" && r.status !== "failed") ? 8000 : false),
  });
  const weakest = Object.entries(q.data?.pillarAvg ?? {}).sort((a, b) => a[1] - b[1])[0]?.[0];
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-4">
        <Panel title="Analyze a call">
          <p className="mb-4 text-[13.5px] text-muted-foreground">Upload a roleplay or live call. It's scored 1–10 on every pillar it covers — including how closely you stayed on script — against the Vantage script and model calls.</p>
          <SubmitCallForm onCreated={(id) => navigate({ to: "/portal/coach/$id", params: { id } })} />
        </Panel>
        <Panel title="Call history" padded={false}>
          {q.isLoading ? <div className="p-4"><TextSkeleton lines={4} /></div> : !q.data?.reviews.length ? (
            <EmptyState title="No calls yet" description="Submit your first call above to get your scorecard." />
          ) : (
            <ul>
              {q.data.reviews.map((r: any) => (
                <li key={r.id} className="border-b border-border last:border-0">
                  <Link to="/portal/coach/$id" params={{ id: r.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                    <div className="w-12 text-center text-[18px] font-semibold tabular-nums text-primary">{r.overall ?? "—"}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{r.title}</div>
                      <div className="text-[12px] text-muted-foreground">{r.call_type === "live" ? "Live call" : "Roleplay"} · {new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                    <StatusBadge status={r.status} />
                    <ChevronRight size={16} className="text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Panel title="Your averages">
          {q.isLoading ? <TextSkeleton lines={6} /> : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <ScoreRing value={q.data?.overallAvg ?? null} label="Avg" />
                <div className="text-[13px]">
                  <div className="text-muted-foreground">{q.data?.reviews.length ?? 0} call{q.data?.reviews.length === 1 ? "" : "s"} analyzed</div>
                  {weakest && <div className="mt-1">Focus on: <span className="font-medium text-primary">{PILLARS.find((p) => p.key === weakest)?.label}</span></div>}
                </div>
              </div>
              <PillarBars scores={q.data?.pillarAvg ?? {}} />
            </div>
          )}
        </Panel>
        <Panel title="Team coaching">
          <p className="text-[13.5px] text-muted-foreground">Leaders: review and score your team's calls in one place.</p>
          <div className="mt-3"><Link to="/portal/coach/team" className={btnClass("secondary", "sm")}><Users size={14} aria-hidden /> Open team coaching</Link></div>
        </Panel>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/portal/training")({
  validateSearch: (search: Record<string, unknown>) => ({ tab: search.tab === "coach" ? "coach" : "days" }),
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
  const { tab } = Route.useSearch();
  const meFn = useServerFn(getMe);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const canReview = (meQ.data?.roles ?? []).some((r: string) => ["super_admin", "admin", "manager", "leader"].includes(r));

  const track = q.data?.track ?? [];
  const approvedCount = track.filter((e) => e.state === "approved").length;
  const currentEntry = track.find((e) => e.state !== "approved" && e.state !== "locked");
  const stage = !q.data ? "" : !q.data.unlocked ? "Onboarding" : q.data.clearedAt ? "Cleared to Call" : currentEntry?.day.is_release ? "Release" : currentEntry ? (currentEntry.day.day_label ?? currentEntry.day.title) : "In review";
  const pct = track.length ? Math.round((approvedCount / track.length) * 100) : 0;
  return (
    <PortalShell>
      <PageBody>
        <section className="p-panel relative mb-4 overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="p-label text-primary">Vantage Training Hub</div>
              <h1 className="mt-1 text-[26px] font-semibold leading-tight">{stage || "Training"}</h1>
              <p className="p-secondary mt-1 max-w-xl">Monday–Thursday reps, then your Friday release call. Each day unlocks when the one before it is approved.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canReview && <Link to="/portal/admin/training" className="rounded-md border border-primary px-3 py-1.5 text-[13px] font-medium text-primary hover:bg-primary/10">Training Admin</Link>}
              {currentEntry && tab === "days" && <Button variant="primary" onClick={() => setOpenId(currentEntry.day.id)}>Continue {currentEntry.day.day_label ?? "training"}</Button>}
              <div className="flex rounded-md border border-border p-0.5" role="tablist" aria-label="Training Hub sections">
                <Link
                  to="/portal/training"
                  search={{ tab: "days" }}
                  aria-current={tab === "days" ? "page" : undefined}
                  className={tab === "days" ? "rounded-[5px] px-3 py-1.5 text-[13px] font-medium" : "rounded-[5px] px-3 py-1.5 text-[13px] text-muted-foreground transition hover:text-foreground"}
                  style={tab === "days" ? { background: "var(--p-gold-soft)", color: "var(--p-gold)" } : undefined}
                >
                  Training days
                </Link>
                <Link
                  to="/portal/training"
                  search={{ tab: "coach" }}
                  aria-current={tab === "coach" ? "page" : undefined}
                  className={tab === "coach" ? "rounded-[5px] px-3 py-1.5 text-[13px] font-medium" : "rounded-[5px] px-3 py-1.5 text-[13px] text-muted-foreground transition hover:text-foreground"}
                  style={tab === "coach" ? { background: "var(--p-gold-soft)", color: "var(--p-gold)" } : undefined}
                >
                  Call Coach
                </Link>
              </div>
            </div>
          </div>
          {tab === "days" && q.data?.unlocked && (
            <div className="relative mt-5">
              <div className="mb-1.5 flex justify-between text-[12px] text-muted-foreground"><span>{approvedCount} of {track.length} days approved</span><span>{pct}%</span></div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--p-border)" }}><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {track.map((e) => (
                  <button key={e.day.id} type="button" disabled={e.state === "locked"} onClick={() => setOpenId(e.day.id)} className="rounded-full border border-border px-3 py-1 text-[12px] transition hover:border-primary disabled:opacity-50" style={e.state === "approved" ? { background: "var(--p-gold-soft)", color: "var(--p-gold)" } : undefined}>
                    {e.state === "approved" ? "✓ " : e.state === "locked" ? "🔒 " : ""}{e.day.day_label ?? e.day.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        {tab === "coach" ? (
          <CoachTab />
        ) : q.isLoading ? (
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
            {track.map((entry) => {
              const current = openId ?? currentEntry?.day.id;
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
      actions={<div className="flex items-center gap-2"><NewContentBadge createdAt={day.created_at} /><Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge></div>}
    >
      {locked ? (
        <p className="text-[13px] text-muted-foreground">{day.is_release ? "Unlocks once your training starts." : "Unlocks when the previous day is approved."}</p>
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
      {day.video_url ? (
        /loom\.com\/share\//.test(day.video_url) && embed ? (
          <div className="aspect-video w-full overflow-hidden rounded-md border border-border">
            <iframe src={embed} title={day.title} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
          </div>
        ) : (
          <VantageMedia url={day.video_url} kind="video" title={day.title} hideTranscript />
        )
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
        <div className="space-y-3">
          <p className="text-muted-foreground">{day.is_release ? "Release call submitted — your trainer will review it. You can upload another attempt anytime." : "Submitted. Your trainer will review it soon."}</p>
          {latest?.review_id && latest?.review && <CoachAnalysis reviewId={latest.review_id} review={latest.review} />}
          {day.is_release && <SubmitForm day={day} />}
        </div>
      ) : (
        <SubmitForm day={day} />
      )}
    </div>
  );
}

/** Shows the automatic Call Coach analysis for a submitted homework recording and polls it to completion. */
function CoachAnalysis({ reviewId, review }: { reviewId: string; review: { status: string; overall: number | null } }) {
  const qc = useQueryClient();
  useReviewPolling(reviewId, review.status, () => qc.invalidateQueries({ queryKey: ["my-training"] }));
  if (review.status === "failed") {
    return <p className="text-[13px] text-muted-foreground">Call Coach couldn't analyze this recording — your trainer will still review it manually.</p>;
  }
  if (review.status !== "done") {
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <span className="h-3 w-3 animate-spin rounded-full border border-border border-t-primary" aria-hidden />
        Call Coach is analyzing your recording against the Gold Standard…
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3 text-[13px]">
      <Badge tone={scoreTone(review.overall ?? 0, 100)}>Coach score {review.overall ?? "—"}/100</Badge>
      <Link to="/portal/coach/$id" params={{ id: reviewId }} className="text-primary underline">View full scorecard</Link>
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
      notify.success(day.is_release ? "Release call submitted" : "Homework submitted"); setLink(""); setNote("");
      qc.invalidateQueries({ queryKey: ["my-training"] });
    },
    onError: (e: Error) => notify.error("Couldn't submit", e.message),
  });

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="p-label">{day.is_release ? "Upload a release call attempt" : "Submit your homework"}</div>
      <ol className="list-decimal space-y-2 pl-5 text-[13px]">
        <li>{day.is_release ? "Run the full call from intro to close — you can attempt your release call anytime." : "Copy today's prompt into ChatGPT and start the roleplay in voice mode."}</li>
        <li>Use Voice Memos on a separate device to record the full roleplay. Make sure both your voice and ChatGPT's voice can be heard clearly.</li>
        <li>Upload the voice memo recording to Google Drive.</li>
        <li>In Google Drive, open Share, set General access to “Anyone with the link” and the role to “Viewer,” then copy the link.</li>
        <li>Paste that recording's shareable link below and submit it for today's review.</li>
      </ol>
      <Field label="Google Drive recording link" hint="Share the recording file, not a folder or ChatGPT conversation."><Input type="url" placeholder="https://drive.google.com/file/d/.../view" value={link} onChange={(e) => setLink(e.target.value)} /></Field>
      {link.trim() && !isGoogleDriveRecordingLink(link) && <p role="alert" className="text-[13px] text-destructive">Enter a Google Drive recording file's shareable link.</p>}
      <Field label="Note (optional)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <Button variant="primary" loading={m.isPending} disabled={!isGoogleDriveRecordingLink(link)} onClick={() => m.mutate()}>{day.is_release ? "Submit release call" : "Submit for review"}</Button>
    </div>
  );
}
