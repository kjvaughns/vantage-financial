import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { CallPlayer, type CallPlayerHandle } from "@/components/coach/CallPlayer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronDown, RefreshCw } from "lucide-react";
import { PortalShell } from "@/components/vantage/portal-shell";
import { Badge, Button, EmptyState, PageBody, PageHeader, Panel, TextSkeleton, Textarea, notify } from "@/components/portal/ui";
import { PillarBars, ScoreRing, StatusBadge, useReviewPolling } from "@/components/vantage/coach";
import { PILLARS, scoreTone } from "@/lib/coach-scoring";
import { addReviewComment, getReview, reanalyzeReview, retryReview } from "@/lib/coach.functions";

export const Route = createFileRoute("/_authenticated/portal/coach/$id")({
  head: () => ({
    meta: [
      { title: "Call Scorecard — Vantage Call Coach" },
      { name: "description", content: "Pillar-by-pillar call scores, coaching and transcript." },
      { property: "og:title", content: "Call Scorecard — Vantage Call Coach" },
      { property: "og:description", content: "Pillar-by-pillar call scores and coaching." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReviewPage,
});

const fmt = (ms: number) => {
  const t = Math.floor(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

function ReviewPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getReview);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["coach-review", id], queryFn: () => fn({ data: { id } }) });
  const r = q.data?.review;
  useReviewPolling(id, r?.status, () => qc.invalidateQueries({ queryKey: ["coach-review", id] }));
  const retryFn = useServerFn(retryReview);
  const retry = useMutation({ mutationFn: () => retryFn({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-review", id] }) });
  const reanalyzeFn = useServerFn(reanalyzeReview);
  const reanalyze = useMutation({
    mutationFn: () => reanalyzeFn({ data: { id } }),
    onSuccess: () => { notify.success("Re-analyzing", "Scoring again against the current Gold Standard."); qc.invalidateQueries({ queryKey: ["coach-review", id] }); },
    onError: (e: Error) => notify.error("Couldn't re-analyze", e.message),
  });

  return (
    <PortalShell>
      <PageBody>
        <Link to="/portal/training" search={{ tab: "coach" }} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft size={14} aria-hidden /> Call Coach</Link>
        {q.isLoading ? <Panel><TextSkeleton lines={6} /></Panel> : q.error || !r ? (
          <Panel><EmptyState title="Couldn't load this call" description={(q.error as Error)?.message} /></Panel>
        ) : (
          <>
            <PageHeader title={r.title} description={`${r.agent_name} · ${r.call_type === "live" ? "Live call" : "Roleplay"} · ${new Date(r.created_at).toLocaleString()}`} actions={
              <div className="flex items-center gap-2">
                {r.status === "done" && (
                  <Button size="sm" variant="ghost" loading={reanalyze.isPending} onClick={() => reanalyze.mutate()} aria-label="Re-analyze this call">
                    <RefreshCw size={14} aria-hidden /> Re-analyze
                  </Button>
                )}
                <StatusBadge status={r.status} />
              </div>
            } />
            {r.status === "failed" ? (
              <Panel>
                <EmptyState title="We couldn't score this call" description={r.error ?? "Something went wrong."} action={q.data!.isOwner ? <Button variant="primary" loading={retry.isPending} onClick={() => retry.mutate()}>Try again</Button> : undefined} />
              </Panel>
            ) : r.status !== "done" ? (
              <Panel>
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden />
                  <div className="text-[15px] font-medium">{r.status === "queued" || r.status === "transcribing" ? "Transcribing your call…" : "Scoring against the Gold Standard…"}</div>
                  <p className="max-w-md text-[13px] text-muted-foreground">This usually takes 2–5 minutes. You can leave this page — your scorecard will be saved.</p>
                </div>
              </Panel>
            ) : (
              <Scorecard review={r} audioUrl={q.data!.audioUrl} driveFileId={(q.data as any).driveFileId ?? null} />
            )}
            <Comments id={id} comments={q.data!.comments} />
          </>
        )}
      </PageBody>
    </PortalShell>
  );
}

function Scorecard({ review: r, audioUrl, driveFileId }: { review: any; audioUrl: string | null; driveFileId: string | null }) {
  const scores = r.pillar_scores ?? {};
  const segments: any[] = r.transcript?.segments ?? [];
  const sections: { pillar: string; start_ms: number }[] = r.transcript?.sections ?? [];
  const sectionAt = new Map<number, string>();
  for (const s of sections) {
    const idx = segments.findIndex((seg, i) => seg.start <= s.start_ms && (segments[i + 1]?.start ?? Infinity) > s.start_ms);
    if (idx >= 0 && !sectionAt.has(idx)) sectionAt.set(idx, PILLARS.find((p) => p.key === s.pillar)?.label ?? s.pillar);
  }
  const [open, setOpen] = useState<string | null>(null);
  const player = useRef<CallPlayerHandle>(null);
  const [nowMs, setNowMs] = useState(-1);
  const canSeek = !!audioUrl;
  const activeIdx = nowMs < 0 ? -1 : segments.findIndex((seg, i) => seg.start <= nowMs && (segments[i + 1]?.start ?? Infinity) > nowMs);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Panel>
          <div className="flex flex-col items-center gap-4 text-center">
            <ScoreRing value={r.overall} size={128} />
            {r.summary && <p className="text-[14px] leading-relaxed">{r.summary}</p>}
            <CallPlayer ref={player} src={audioUrl} driveFileId={driveFileId} onTime={setNowMs} />
          </div>
        </Panel>
        <Panel title="Pillars"><PillarBars scores={scores} /></Panel>
      </div>
      {Array.isArray(r.improvements) && r.improvements.length > 0 && (
        <Panel title="Top 3 fixes">
          <ol className="space-y-2">
            {r.improvements.map((t: string, i: number) => (
              <li key={i} className="flex gap-3 text-[14px]"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[12px] font-semibold text-primary">{i + 1}</span>{t}</li>
            ))}
          </ol>
        </Panel>
      )}
      <Panel title="Pillar breakdown" padded={false}>
        {PILLARS.map((p) => {
          const s = scores[p.key];
          if (!s) return null;
          const isOpen = open === p.key;
          return (
            <div key={p.key} className="border-b border-border last:border-0">
              <button type="button" onClick={() => setOpen(isOpen ? null : p.key)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30" aria-expanded={isOpen}>
                <Badge tone={scoreTone(s.score)}>{s.score}/10</Badge>
                <span className="flex-1 text-[14px] font-medium">{p.label}</span>
                <ChevronDown size={16} className={`transition ${isOpen ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {isOpen && (
                <div className="space-y-3 px-4 pb-4 text-[13.5px]">
                  {s.went_well && <div><div className="p-label mb-1">What went well</div>{s.went_well}</div>}
                  {s.to_fix && <div><div className="p-label mb-1">What to fix</div>{s.to_fix}</div>}
                  {s.better_line && <div className="rounded-md border border-primary/30 bg-primary/5 p-3"><div className="p-label mb-1 text-primary">Say it like the script</div>“{s.better_line}”</div>}
                </div>
              )}
            </div>
          );
        })}
      </Panel>
      {segments.length > 0 && (
        <Panel title="Transcript">
          <div className="max-h-[480px] space-y-2 overflow-auto pr-1 text-[13px]">
            {segments.map((seg, i) => (
              <div key={i}>
                {sectionAt.has(i) && <div className="mb-1 mt-3"><Badge tone="gold">{sectionAt.get(i)}</Badge></div>}
                <div className={`flex gap-3 rounded px-1 ${i === activeIdx ? "bg-primary/10" : ""}`}>
                  {canSeek ? (
                    <button type="button" onClick={() => player.current?.seek(seg.start)} className="w-12 shrink-0 text-left tabular-nums text-primary hover:underline" aria-label={`Play from ${fmt(seg.start)}`}>{fmt(seg.start)}</button>
                  ) : (
                    <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{fmt(seg.start)}</span>
                  )}
                  <p><span className="font-medium">{seg.speaker ? `${seg.speaker}: ` : ""}</span>{seg.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function Comments({ id, comments }: { id: string; comments: any[] }) {
  const qc = useQueryClient();
  const fn = useServerFn(addReviewComment);
  const [body, setBody] = useState("");
  const m = useMutation({
    mutationFn: () => fn({ data: { id, body } }),
    onSuccess: () => { setBody(""); qc.invalidateQueries({ queryKey: ["coach-review", id] }); },
    onError: (e: Error) => notify.error("Couldn't comment", e.message),
  });
  return (
    <Panel title="Coaching notes" className="mt-4">
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="rounded-md border border-border p-3 text-[13.5px]">
            <div className="mb-1 text-[12px] text-muted-foreground">{c.author_name} · {new Date(c.created_at).toLocaleString()}</div>
            <p className="whitespace-pre-line">{c.body}</p>
          </div>
        ))}
        <Textarea rows={2} placeholder="Leave a coaching note…" value={body} onChange={(e) => setBody(e.target.value)} />
        <Button size="sm" variant="primary" disabled={!body.trim()} loading={m.isPending} onClick={() => m.mutate()}>Post note</Button>
      </div>
    </Panel>
  );
}
