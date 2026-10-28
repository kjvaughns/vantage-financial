import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { Loader2 } from "lucide-react";
import { VantageMedia } from "@/components/media/VantageMedia";
import { PillarBars, ScoreRing } from "@/components/vantage/coach";
import { Badge, Button, EmptyState, Field, Input, PageBody, PageHeader, Panel, Tabs, TextSkeleton, Textarea, Toggle, notify } from "@/components/portal/ui";
import { listTrainingDaysAdmin, listTrainingReview, reviewSubmission, saveTrainingDay, type TrainingDay } from "@/lib/training.functions";

export const Route = createFileRoute("/_authenticated/portal/admin/training")({
  head: () => ({
    meta: [{ title: "Training Review — Vantage Portal" }, { name: "description", content: "Review Vantage training recordings, approve daily homework and manage release calls." }, { property: "og:title", content: "Training Review — Vantage Portal" }, { property: "og:description", content: "Review agent recordings and manage training approvals and release calls." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminTrainingPage,
});

type View = "waiting" | "release" | "cleared" | "content";

function AdminTrainingPage() {
  const [view, setView] = useState<View>("waiting");
  const listFn = useServerFn(listTrainingReview);
  const counts = useQuery({ queryKey: ["training-review", "waiting"], queryFn: () => listFn({ data: { filter: "waiting" } }) }).data?.counts;
  const c = (n?: number) => (n ? ` (${n})` : "");
  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Training Review" description="Listen, check the AI score, then approve or send back — oldest first." />
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { value: "waiting", label: `Waiting on review${c(counts?.waiting)}` },
            { value: "release", label: `Ready for release${c(counts?.release)}` },
            { value: "cleared", label: "Cleared to call" },
            { value: "content", label: "Training content" },
          ]}
        />
        <div className="mt-4">{view === "content" ? <ContentEditor /> : <ReviewQueue filter={view} />}</div>
      </PageBody>
    </PortalShell>
  );
}

function ReviewQueue({ filter }: { filter: "waiting" | "release" | "cleared" }) {
  const listFn = useServerFn(listTrainingReview);
  const [agent, setAgent] = useState("all");
  const q = useQuery({
    queryKey: ["training-review", filter],
    queryFn: () => listFn({ data: { filter } }),
    refetchInterval: (query) => ((query.state.data?.submissions ?? []).some((s: any) => s.call_review && !["completed", "failed"].includes(s.call_review.status)) ? 5000 : false),
  });
  if (q.isLoading) return <Panel><TextSkeleton lines={4} /></Panel>;
  if (q.error) return <Panel><EmptyState title="Couldn't load" description={(q.error as Error).message} /></Panel>;
  if (filter === "cleared") {
    const rows = q.data!.cleared as any[];
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
  const all = q.data!.submissions as any[];
  if (!all.length) return <Panel><EmptyState title={filter === "release" ? "No release calls requested" : "All caught up — nothing waiting on review"} /></Panel>;
  const agents = [...new Map(all.map((s) => [s.profile_id, s.agent_name])).entries()];
  const subs = agent === "all" ? all : all.filter((s) => s.profile_id === agent);
  return (
    <div className="space-y-3">
      {agents.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {[["all", "All agents"], ...agents].map(([id, name]) => (
            <button key={id} type="button" onClick={() => setAgent(id)} className={`rounded-full border px-3 py-1 text-[12.5px] ${agent === id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{name}</button>
          ))}
        </div>
      )}
      {subs.map((s) => <ReviewCard key={s.id} s={s} />)}
    </div>
  );
}

const CHIPS = ["Great intro", "Slow down", "Dig deeper on needs analysis", "Follow the script", "Missed the close", "More confident tone"];

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function ReviewCard({ s }: { s: any }) {
  const qc = useQueryClient();
  const reviewFn = useServerFn(reviewSubmission);
  const [feedback, setFeedback] = useState("");
  const isRelease = !!s.day?.is_release;
  const cr = s.call_review;
  const m = useMutation({
    mutationFn: (decision: "approve" | "redo") => reviewFn({ data: { id: s.id, decision, feedback: feedback.trim() || null } }),
    onSuccess: (_r, d) => {
      notify.success(d === "approve" ? (isRelease ? "Release passed — cleared to call" : "Approved") : "Sent back with feedback");
      qc.invalidateQueries({ queryKey: ["training-review"] });
    },
    onError: (e: Error) => notify.error("Couldn't save review", e.message),
  });
  const addChip = (c: string) => setFeedback((f) => (f.includes(c) ? f : f ? `${f.trim()}\n• ${c}` : `• ${c}`));
  const lastRedo = s.prior_redos?.[0];
  return (
    <Panel
      title={
        <span>
          {s.applicant_id ? <Link to="/portal/applicants/$applicantId" params={{ applicantId: s.applicant_id }} className="hover:underline">{s.agent_name}</Link> : s.agent_name}
          <span className="text-muted-foreground">{" · "}{s.day?.day_label ? `${s.day.day_label} · ` : ""}{s.day?.title}</span>
        </span>
      }
      actions={<span className="text-[12px] text-muted-foreground">{ago(s.created_at)}</span>}
    >
      <div className="space-y-4 text-[14px]">
        {s.prior_redos?.length > 0 && (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[12.5px] text-muted-foreground">
            Previous attempts: sent back {s.prior_redos.length}× {lastRedo?.feedback ? <>— last note: “{lastRedo.feedback}”</> : null}
          </div>
        )}
        {!isRelease && (
          <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3">
              {s.file_url ? <video src={s.file_url} controls className="w-full rounded" /> : <VantageMedia kind="audio" directSrc={cr?.audioUrl ?? null} url={cr?.audioUrl ? null : s.drive_file_id ? `https://drive.google.com/file/d/${s.drive_file_id}/view` : null} hideTranscript />}
              {s.note && <p className="text-[13px] text-muted-foreground">Agent note: {s.note}</p>}
            </div>
            <div>
              {!cr ? (
                <p className="text-[13px] text-muted-foreground">No AI score for this submission.</p>
              ) : cr.status === "failed" ? (
                <p className="text-[13px] text-muted-foreground">AI analysis couldn't run (check the Drive link is shared).</p>
              ) : cr.status !== "completed" ? (
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
        )}
        {isRelease && s.note && <p>{s.note}</p>}
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
