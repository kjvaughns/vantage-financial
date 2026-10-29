import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { Loader2 } from "lucide-react";
import { VantageMedia } from "@/components/media/VantageMedia";
import { PillarBars, ScoreRing, useReviewPolling } from "@/components/vantage/coach";
import { Badge, Button, EmptyState, Field, Input, PageBody, PageHeader, Panel, Select, Tabs, TextSkeleton, Textarea, Toggle, notify } from "@/components/portal/ui";
import { scoreTone } from "@/lib/coach-scoring";
import { getAgentTrainingReview, listReviewAgents, listTrainingDaysAdmin, listTrainingReview, reviewSubmission, saveTrainingDay, type TrainingDay } from "@/lib/training.functions";

export const Route = createFileRoute("/_authenticated/portal/admin/training")({
  head: () => ({
    meta: [{ title: "Training Review — Vantage Portal" }, { name: "description", content: "Review Vantage training recordings, approve daily homework and manage release calls." }, { property: "og:title", content: "Training Review — Vantage Portal" }, { property: "og:description", content: "Review agent recordings and manage training approvals and release calls." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminTrainingPage,
});


type View = "agents" | "cleared" | "content";

function AdminTrainingPage() {
  const [view, setView] = useState<View>("agents");
  const agentsFn = useServerFn(listReviewAgents);
  const agentsQ = useQuery({ queryKey: ["training-review", "agents"], queryFn: () => agentsFn(), refetchInterval: 30000 });
  const total = (agentsQ.data?.agents ?? []).reduce((n, a) => n + a.waiting + a.release, 0);
  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Training Admin" description="Click a trainee to see every attempt and review it." />
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { value: "agents", label: `Trainees${total ? ` (${total} to review)` : ""}` },
            { value: "cleared", label: "Cleared to call" },
            { value: "content", label: "Training content" },
          ]}
        />
        <div className="mt-4">{view === "content" ? <ContentEditor /> : view === "cleared" ? <ClearedList /> : <AgentReview agents={agentsQ.data?.agents ?? []} loading={agentsQ.isLoading} />}</div>
      </PageBody>
    </PortalShell>
  );
}

function ClearedList() {
  const listFn = useServerFn(listTrainingReview);
  const q = useQuery({ queryKey: ["training-review", "cleared"], queryFn: () => listFn({ data: { filter: "cleared" } }) });
  if (q.isLoading) return <Panel><TextSkeleton lines={4} /></Panel>;
  const rows = (q.data?.cleared ?? []) as any[];
  if (!rows.length) return <Panel><EmptyState title="Nobody cleared yet" /></Panel>;
  return (
    <Panel>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2 text-[14px]">
            <Link to="/portal/applicants/$applicantId" params={{ applicantId: r.id }} className="hover:underline">{r.first_name} {r.last_name}</Link>
            <Badge tone="green">{new Date(r.cleared_to_call_at).toLocaleDateString()}</Badge>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

type Agent = { profile_id: string; name: string; waiting: number; release: number; attempts: number; approved: number; oldest: string; last: string };

function AgentReview({ agents, loading }: { agents: Agent[]; loading: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  if (loading) return <Panel><TextSkeleton lines={4} /></Panel>;
  if (picked) {
    const i = agents.findIndex((a) => a.profile_id === picked);
    const next = agents.slice(i + 1).find((a) => a.waiting + a.release > 0) ?? agents.find((a) => a.profile_id !== picked && a.waiting + a.release > 0);
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => setPicked(null)}>← All trainees</Button>
        <AgentPanel key={picked} profileId={picked} onDoneAll={() => setPicked(next?.profile_id ?? null)} />
      </div>
    );
  }
  const list = agents.filter((a) => a.name.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <Panel padded={false}>
      <div className="border-b border-border p-3">
        <Input placeholder="Search trainees" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search trainees" />
      </div>
      {!list.length ? (
        <p className="p-4 text-[13px] text-muted-foreground">{agents.length ? "No trainees match." : "No trainees have submitted anything yet."}</p>
      ) : (
        <ul>
          {list.map((a) => {
            const waiting = a.waiting + a.release;
            return (
              <li key={a.profile_id}>
                <button type="button" onClick={() => setPicked(a.profile_id)} className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-medium">{a.name}</div>
                    <div className="text-[12.5px] text-muted-foreground">{a.attempts} attempt{a.attempts === 1 ? "" : "s"} · {a.approved} approved · last {ago(a.last)}</div>
                  </div>
                  {a.release > 0 && <Badge tone="gold">Release call</Badge>}
                  {waiting > 0 ? <Badge tone="amber">{waiting} to review</Badge> : <Badge tone="neutral">Up to date</Badge>}
                  <span className="text-muted-foreground" aria-hidden>›</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

const STATE_STYLE: Record<string, { label: string; tone: "green" | "amber" | "red" | "neutral" | "gold" }> = {
  approved: { label: "Approved", tone: "green" },
  submitted: { label: "Waiting", tone: "amber" },
  redo: { label: "Sent back", tone: "red" },
  open: { label: "Not started", tone: "neutral" },
  locked: { label: "Locked", tone: "neutral" },
};

function AgentPanel({ profileId, onDoneAll }: { profileId: string; onDoneAll: () => void }) {
  const fn = useServerFn(getAgentTrainingReview);
  const q = useQuery({
    queryKey: ["training-review", "agent", profileId],
    queryFn: () => fn({ data: { profileId } }),
    refetchInterval: (query) => ((query.state.data?.days ?? []).some((d: any) => d.attempts.some((s: any) => s.call_review && !["done", "failed"].includes(s.call_review.status))) ? 5000 : false),
  });
  const firstWaiting = q.data?.days.find((d) => d.state === "submitted")?.day.id ?? null;
  const [dayId, setDayId] = useState<string | null>(null);
  const active = q.data?.days.find((d) => d.day.id === (dayId ?? firstWaiting)) ?? q.data?.days.find((d) => d.attempts.length) ?? q.data?.days[0];
  if (q.isLoading) return <Panel><TextSkeleton lines={6} /></Panel>;
  if (q.error || !q.data) return <Panel><EmptyState title="Couldn't load this agent" description={(q.error as Error)?.message} /></Panel>;
  const waitingCount = q.data.days.reduce((n, d) => n + d.attempts.filter((s: any) => s.status === "submitted").length, 0);
  const afterReview = async () => {
    const r = await q.refetch();
    const next = r.data?.days.find((d) => d.state === "submitted" || d.attempts.some((s: any) => s.status === "submitted"));
    if (next) setDayId(next.day.id);
    else onDoneAll();
  };
  return (
    <div className="space-y-4">
      {q.data.days.flatMap((d) => d.attempts).filter((s: any) => s.call_review && !["done", "failed"].includes(s.call_review.status)).map((s: any) => (
        <PendingReview key={s.call_review.id} review={s.call_review} onChange={() => { void q.refetch(); }} />
      ))}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[16px] font-semibold">
              {q.data.applicantId ? <Link to="/portal/applicants/$applicantId" params={{ applicantId: q.data.applicantId }} className="hover:underline">{q.data.name}</Link> : q.data.name}
            </div>
            <div className="text-[12.5px] text-muted-foreground">{q.data.clearedAt ? "Cleared to call" : `${waitingCount} waiting on review`}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {q.data.days.map((d) => {
            const st = STATE_STYLE[d.state] ?? STATE_STYLE.open;
            const on = active?.day.id === d.day.id;
            return (
              <button key={d.day.id} type="button" onClick={() => setDayId(d.day.id)} className={`flex min-w-[96px] flex-col items-start rounded-md border px-3 py-2 text-left text-[12.5px] ${on ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"}`}>
                <span className="font-medium">{d.day.is_release ? "Release" : d.day.day_label ?? d.day.title}</span>
                <Badge tone={st.tone}>{st.label}{d.attempts.length > 1 ? ` · ${d.attempts.length}` : ""}</Badge>
              </button>
            );
          })}
        </div>
      </Panel>
      {active && <DayAttempts key={active.day.id} entry={active} onReviewed={afterReview} />}
    </div>
  );
}

function PendingReview({ review, onChange }: { review: { id: string; status: string }; onChange: () => void }) {
  useReviewPolling(review.id, review.status, onChange);
  return null;
}

function DayAttempts({ entry, onReviewed }: { entry: any; onReviewed: () => void }) {
  const attempts: any[] = entry.attempts;
  if (!attempts.length) return <Panel><EmptyState title="Nothing submitted for this day yet" /></Panel>;
  const pending = attempts.filter((s) => s.status === "submitted");
  const history = attempts.filter((s) => s.status !== "submitted");
  return (
    <div className="space-y-4">
      {pending.map((s, i) => <ReviewCard key={s.id} s={s} day={entry.day} attemptNo={attempts.length - attempts.indexOf(s)} onReviewed={onReviewed} highlight={i === 0} />)}
      {history.length > 0 && (
        <Panel title="Past attempts">
          <div className="grid gap-3 md:grid-cols-2">
            {history.map((s) => {
              const cr = s.call_review;
              return (
                <div key={s.id} className="space-y-2 rounded-md border border-border p-3 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">Attempt #{attempts.length - attempts.indexOf(s)}</span>
                    <div className="flex items-center gap-2">
                      {cr?.status === "done" && <Badge tone={scoreTone(cr.overall ?? 0, 100)}>{cr.overall}/100</Badge>}
                      <Badge tone={s.status === "approved" ? "green" : "red"}>{s.status === "approved" ? "Approved" : "Sent back"}</Badge>
                    </div>
                  </div>
                  <div className="text-[12px] text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                  <TrainingRecording submission={s} />
                  {s.feedback && <p className="whitespace-pre-line">“{s.feedback}”</p>}
                  {cr && <Link to="/portal/coach/$id" params={{ id: cr.id }} className="text-primary underline">Scorecard</Link>}
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

const CHIPS = ["Great intro", "Slow down", "Dig deeper on needs analysis", "Follow the script", "Missed the close", "More confident tone"];

function TrainingRecording({ submission: s }: { submission: any }) {
  const cr = s.call_review;
  const directSrc = cr?.audioUrl ?? s.file_url ?? null;
  const url = s.link_url ?? (s.drive_file_id ? `https://drive.google.com/file/d/${s.drive_file_id}/view` : null);
  if (!directSrc && !url) return <p className="text-[13px] text-muted-foreground">No recording attached.</p>;
  const segments = cr?.transcript?.segments ?? [];
  const hasTranscript = segments.length > 0 || !!cr?.transcript_text;
  return (
    <div className="min-w-0 space-y-2">
      <VantageMedia
        kind="video"
        directSrc={directSrc}
        url={directSrc ? null : url}
        title="Training recording"
        segments={segments}
        fallbackText={cr?.transcript_text}
        transcriptHeight={320}
      />
      {!hasTranscript && <p className="text-[13px] text-muted-foreground">{cr && !["done", "failed"].includes(cr.status) ? "Transcript is being prepared…" : "No transcript available for this recording yet."}</p>}
    </div>
  );
}

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function ReviewCard({ s, day, attemptNo, onReviewed, highlight }: { s: any; day: any; attemptNo: number; onReviewed: () => void; highlight: boolean }) {
  const qc = useQueryClient();
  const reviewFn = useServerFn(reviewSubmission);
  const [feedback, setFeedback] = useState("");
  const isRelease = !!day?.is_release;
  const cr = s.call_review;
  const m = useMutation({
    mutationFn: (decision: "approve" | "redo") => reviewFn({ data: { id: s.id, decision, feedback: feedback.trim() || null } }),
    onSuccess: (_r, d) => {
      notify.success(d === "approve" ? (isRelease ? "Release passed — cleared to call" : "Approved") : "Sent back with feedback");
      qc.invalidateQueries({ queryKey: ["training-review", "agents"] });
      onReviewed();
    },
    onError: (e: Error) => notify.error("Couldn't save review", e.message),
  });
  const addChip = (c: string) => setFeedback((f) => (f.includes(c) ? f : f ? `${f.trim()}\n• ${c}` : `• ${c}`));
  return (
    <Panel
      title={<span>{isRelease ? "Release call" : `${day?.day_label ? `${day.day_label} · ` : ""}${day?.title ?? ""}`}<span className="text-muted-foreground"> · Attempt #{attemptNo}</span></span>}
      actions={<span className="text-[12px] text-muted-foreground">{highlight ? <Badge tone="amber">Up next</Badge> : null} {ago(s.created_at)}</span>}
    >
      <div className="space-y-4 text-[14px]">
        <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <TrainingRecording submission={s} />
            {s.note && <p className="text-[13px] text-muted-foreground">Agent note: {s.note}</p>}
          </div>
          <div>
            {!cr ? (
              <p className="text-[13px] text-muted-foreground">No AI score for this submission.</p>
            ) : cr.status === "failed" ? (
              <p className="text-[13px] text-muted-foreground">AI analysis couldn't run (check the Drive link is shared).</p>
            ) : cr.status !== "done" ? (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Analyzing the call…</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <ScoreRing value={cr.overall} size={72} />
                  <Link to="/portal/coach/$id" params={{ id: cr.id }} className="text-[13px] text-primary underline">Full scorecard</Link>
                </div>
                <PillarBars scores={cr.pillar_scores ?? {}} />
                {Array.isArray(cr.improvements) && cr.improvements.length > 0 && (
                  <ol className="list-decimal space-y-1 pl-5 text-[13px]">{cr.improvements.slice(0, 3).map((t: string, i: number) => <li key={i}>{t}</li>)}</ol>
                )}
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {CHIPS.map((c) => (
              <button key={c} type="button" onClick={() => addChip(c)} className="rounded-full border border-border px-2.5 py-1 text-[12px] hover:border-primary hover:text-primary">+ {c}</button>
            ))}
          </div>
          <Textarea rows={3} placeholder="Feedback for the agent (required to send back)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" loading={m.isPending && m.variables === "approve"} disabled={m.isPending} onClick={() => m.mutate("approve")}>{isRelease ? "Passed — clear to call" : "Approve"}</Button>
          <Button variant="secondary" className="flex-1" loading={m.isPending && m.variables === "redo"} disabled={m.isPending || !feedback.trim()} onClick={() => m.mutate("redo")}>{isRelease ? "Not yet" : "Send back"}</Button>
        </div>
      </div>
    </Panel>
  );
}

function ContentEditor() {
  const listFn = useServerFn(listTrainingDaysAdmin);
  const q = useQuery({ queryKey: ["training-days-admin"], queryFn: () => listFn() });
  const [adding, setAdding] = useState(false);
  if (q.isLoading) return <Panel><TextSkeleton lines={4} /></Panel>;
  if (q.error) return <Panel><EmptyState title="You can't edit training content" description={(q.error as Error).message} /></Panel>;
  const days = q.data!;
  return (
    <div className="space-y-3">
      {days.map((d) => <DayEditor key={d.id} day={d} />)}
      {adding ? (
        <DayEditor day={{ title: "", position: (days.at(-1)?.position ?? 0) + 1, checklist: [], is_release: false, is_published: false } as any} onDone={() => setAdding(false)} />
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>Add a training day</Button>
      )}
    </div>
  );
}

function DayEditor({ day, onDone }: { day: Partial<TrainingDay>; onDone?: () => void }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveTrainingDay);
  const [f, setF] = useState({
    title: day.title ?? "",
    day_label: day.day_label ?? "",
    position: day.position ?? 0,
    video_url: day.video_url ?? "",
    objective: day.objective ?? "",
    prompt: day.prompt ?? "",
    instructions: day.instructions ?? "",
    checklist: (day.checklist ?? []).join("\n"),
    is_release: day.is_release ?? false,
    is_published: day.is_published ?? true,
  });
  const set = (k: keyof typeof f, v: any) => setF((p) => ({ ...p, [k]: v }));
  const m = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: day.id,
          ...f,
          position: Number(f.position) || 0,
          day_label: f.day_label || null,
          video_url: f.video_url || null,
          objective: f.objective || null,
          prompt: f.prompt || null,
          instructions: f.instructions || null,
          checklist: f.checklist.split("\n").map((s) => s.trim()).filter(Boolean),
        },
      }),
    onSuccess: () => {
      notify.success("Training day saved");
      qc.invalidateQueries({ queryKey: ["training-days-admin"] });
      onDone?.();
    },
    onError: (e: Error) => notify.error("Couldn't save", e.message),
  });
  return (
    <Panel
      title={`${f.day_label ? `${f.day_label} · ` : ""}${f.title || "New training day"}`}
      actions={<div className="flex items-center gap-2">{f.is_release && <Badge tone="gold">Release</Badge>}{!f.is_published && <Badge>Hidden</Badge>}</div>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title"><Input value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Day label"><Input value={f.day_label} placeholder="Monday" onChange={(e) => set("day_label", e.target.value)} /></Field>
          <Field label="Order"><Input type="number" value={f.position} onChange={(e) => set("position", e.target.value)} /></Field>
        </div>
        <Field label="Lesson video link" hint="YouTube, Loom, Vimeo or any link." className="sm:col-span-2"><Input value={f.video_url} onChange={(e) => set("video_url", e.target.value)} /></Field>
        <Field label="Objective" className="sm:col-span-2"><Input value={f.objective} onChange={(e) => set("objective", e.target.value)} /></Field>
        <Field label="ChatGPT roleplay prompt" hint="Agents get a one-click Copy button." className="sm:col-span-2"><Textarea rows={6} value={f.prompt} onChange={(e) => set("prompt", e.target.value)} /></Field>
        <Field label="Instructions" className="sm:col-span-2"><Textarea rows={3} value={f.instructions} onChange={(e) => set("instructions", e.target.value)} /></Field>
        <Field label="Checklist (one per line)" className="sm:col-span-2"><Textarea rows={3} value={f.checklist} onChange={(e) => set("checklist", e.target.value)} /></Field>
        <div className="flex flex-wrap gap-6 sm:col-span-2">
          <Toggle checked={f.is_published} onChange={(v: boolean) => set("is_published", v)} label="Visible to agents" />
          <Toggle checked={f.is_release} onChange={(v: boolean) => set("is_release", v)} label="This is the release call" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" loading={m.isPending} disabled={!f.title.trim()} onClick={() => m.mutate()}>Save</Button>
        {onDone && <Button variant="ghost" onClick={onDone}>Cancel</Button>}
      </div>
    </Panel>
  );
}
