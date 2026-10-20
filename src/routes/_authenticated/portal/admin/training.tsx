import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { Badge, Button, EmptyState, Field, Input, PageBody, PageHeader, Panel, Tabs, TextSkeleton, Textarea, Toggle, notify } from "@/components/portal/ui";
import { listTrainingDaysAdmin, listTrainingReview, reviewSubmission, saveTrainingDay, type TrainingDay } from "@/lib/training.functions";

export const Route = createFileRoute("/_authenticated/portal/admin/training")({
  head: () => ({
    meta: [{ title: "Training Review — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminTrainingPage,
});

type View = "waiting" | "release" | "cleared" | "content";

function AdminTrainingPage() {
  const [view, setView] = useState<View>("waiting");
  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Training Review" description="Approve homework, run release calls, and edit each training day." />
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { value: "waiting", label: "Waiting on review" },
            { value: "release", label: "Ready for release" },
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
  const q = useQuery({ queryKey: ["training-review", filter], queryFn: () => listFn({ data: { filter } }) });
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
  const subs = q.data!.submissions;
  if (!subs.length) return <Panel><EmptyState title={filter === "release" ? "No release calls requested" : "Nothing waiting on review"} /></Panel>;
  return <div className="space-y-3">{subs.map((s: any) => <ReviewCard key={s.id} s={s} />)}</div>;
}

function ReviewCard({ s }: { s: any }) {
  const qc = useQueryClient();
  const reviewFn = useServerFn(reviewSubmission);
  const [feedback, setFeedback] = useState("");
  const isRelease = !!s.day?.is_release;
  const m = useMutation({
    mutationFn: (decision: "approve" | "redo") => reviewFn({ data: { id: s.id, decision, feedback: feedback.trim() || null } }),
    onSuccess: (_r, d) => {
      notify.success(d === "approve" ? (isRelease ? "Release passed — cleared to call" : "Approved") : "Sent back with feedback");
      qc.invalidateQueries({ queryKey: ["training-review"] });
    },
    onError: (e: Error) => notify.error("Couldn't save review", e.message),
  });
  return (
    <Panel
      title={
        <span>
          {s.applicant_id ? (
            <Link to="/portal/applicants/$applicantId" params={{ applicantId: s.applicant_id }} className="hover:underline">{s.agent_name}</Link>
          ) : s.agent_name}
          {" · "}{s.day?.day_label ? `${s.day.day_label} ` : ""}{s.day?.title}
        </span>
      }
      actions={<span className="text-[12px] text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>}
    >
      <div className="space-y-3 text-[14px]">
        {s.file_url && <video src={s.file_url} controls className="w-full max-w-xl rounded" />}
        {s.link_url && <a href={s.link_url} target="_blank" rel="noreferrer" className="text-primary underline">Open ChatGPT link</a>}
        {s.note && <p>{s.note}</p>}
        <Field label="Feedback for the agent"><Textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></Field>
        <div className="flex gap-2">
          <Button variant="primary" loading={m.isPending} onClick={() => m.mutate("approve")}>{isRelease ? "Passed — clear to call" : "Approve"}</Button>
          <Button variant="secondary" disabled={m.isPending} onClick={() => m.mutate("redo")}>{isRelease ? "Not yet" : "Send back"}</Button>
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
