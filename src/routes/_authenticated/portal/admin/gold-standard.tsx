import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Trash2 } from "lucide-react";
import { PortalShell } from "@/components/vantage/portal-shell";
import { Badge, Button, EmptyState, Field, Input, PageBody, PageHeader, Panel, TextSkeleton, Textarea, Toggle, notify } from "@/components/portal/ui";
import { MediaPicker, StatusBadge, uploadRecording } from "@/components/vantage/coach";
import { PILLARS } from "@/lib/coach-scoring";
import {
  addReferenceCall,
  advanceReferenceCall,
  deleteScript,
  getGoldStandard,
  promoteReviewToReference,
  saveCoachSettings,
  saveScript,
  syncScriptFromDoc,
  updateReferenceCall,
} from "@/lib/coach.functions";

export const Route = createFileRoute("/_authenticated/portal/admin/gold-standard")({
  head: () => ({
    meta: [
      { title: "Gold Standard — Vantage Admin" },
      { name: "description", content: "Scripts, model calls and scoring rules that the Call Coach judges against." },
      { property: "og:title", content: "Gold Standard — Vantage Admin" },
      { property: "og:description", content: "Call Coach scripts, model calls and scoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GoldStandardPage,
});

const KEY = ["coach-gold"];

function GoldStandardPage() {
  const fn = useServerFn(getGoldStandard);
  const q = useQuery({ queryKey: KEY, queryFn: () => fn(), refetchInterval: (qq) => ((qq.state.data?.calls ?? []).some((c: any) => c.status === "queued" || c.status === "transcribing") ? 6000 : false) });
  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Gold Standard" description="The Call Coach judges every call only against what's here: your scripts and your model calls." />
        {q.isLoading ? <Panel><TextSkeleton lines={6} /></Panel> : q.error ? <Panel><EmptyState title="Couldn't load" description={(q.error as Error).message} /></Panel> : (
          <div className="space-y-4">
            <Scripts scripts={q.data!.scripts} />
            <ReferenceCalls calls={q.data!.calls} candidates={q.data!.candidates} />
            <Scoring settings={q.data!.settings} />
          </div>
        )}
      </PageBody>
    </PortalShell>
  );
}

function Scripts({ scripts }: { scripts: any[] }) {
  const qc = useQueryClient();
  const sync = useServerFn(syncScriptFromDoc);
  const [url, setUrl] = useState("");
  const m = useMutation({
    mutationFn: (docUrl: string) => sync({ data: { docUrl } }),
    onSuccess: (r) => { notify.success("Script synced", r.title); setUrl(""); qc.invalidateQueries({ queryKey: KEY }); },
    onError: (e: Error) => notify.error("Couldn't sync", e.message),
  });
  return (
    <Panel title="Scripts" description="Imported from Google Docs. Re-sync any time you update the doc.">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input placeholder="https://docs.google.com/document/d/..." value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button variant="primary" loading={m.isPending && !!url} disabled={!url.trim()} onClick={() => m.mutate(url.trim())}>Import doc</Button>
        </div>
        {scripts.length === 0 && <p className="text-[13px] text-muted-foreground">No scripts yet. Import your script and objection sheet.</p>}
        {scripts.map((s) => <ScriptRow key={s.id} s={s} onSync={() => m.mutate(s.source_doc_id)} syncing={m.isPending} />)}
      </div>
    </Panel>
  );
}

function ScriptRow({ s, onSync, syncing }: { s: any; onSync: () => void; syncing: boolean }) {
  const qc = useQueryClient();
  const save = useServerFn(saveScript);
  const del = useServerFn(deleteScript);
  const [edit, setEdit] = useState(false);
  const [content, setContent] = useState(s.content);
  useEffect(() => setContent(s.content), [s.content]);
  const sm = useMutation({
    mutationFn: (v: { content?: string; isActive?: boolean }) => save({ data: { id: s.id, title: s.title, content: v.content ?? s.content, isActive: v.isActive ?? s.is_active } }),
    onSuccess: () => { setEdit(false); qc.invalidateQueries({ queryKey: KEY }); },
    onError: (e: Error) => notify.error("Couldn't save", e.message),
  });
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 font-medium">{s.title}</span>
        <span className="text-[12px] text-muted-foreground">{s.content.length.toLocaleString()} chars{s.synced_at ? ` · synced ${new Date(s.synced_at).toLocaleDateString()}` : ""}</span>
        <Toggle checked={s.is_active} onChange={(v: boolean) => sm.mutate({ isActive: v })} label="Active" />
        {s.source_doc_id && <Button size="sm" onClick={onSync} loading={syncing}><RefreshCw size={13} aria-hidden /> Re-sync</Button>}
        <Button size="sm" onClick={() => setEdit(!edit)}>{edit ? "Close" : "Edit"}</Button>
        <Button size="sm" variant="ghost" aria-label="Delete script" onClick={async () => { if (confirm("Delete this script?")) { await del({ data: { id: s.id } }); qc.invalidateQueries({ queryKey: KEY }); } }}><Trash2 size={14} aria-hidden /></Button>
      </div>
      {edit && (
        <div className="mt-3 space-y-2">
          <Textarea rows={14} value={content} onChange={(e) => setContent(e.target.value)} className="font-mono text-[12.5px]" />
          <p className="text-[12px] text-muted-foreground">Edits here are overwritten by the next re-sync.</p>
          <Button size="sm" variant="primary" loading={sm.isPending} onClick={() => sm.mutate({ content })}>Save</Button>
        </div>
      )}
    </div>
  );
}

function ReferenceCalls({ calls, candidates }: { calls: any[]; candidates: any[] }) {
  const qc = useQueryClient();
  const add = useServerFn(addReferenceCall);
  const advance = useServerFn(advanceReferenceCall);
  const upd = useServerFn(updateReferenceCall);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"upload" | "drive">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  useEffect(() => {
    const pending = calls.filter((c) => c.status === "queued" || c.status === "transcribing");
    if (!pending.length) return;
    const t = setTimeout(async () => {
      await Promise.all(pending.map((c) => advance({ data: { id: c.id } }).catch(() => null)));
      qc.invalidateQueries({ queryKey: KEY });
    }, 4000);
    return () => clearTimeout(t);
  }, [calls]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMutation({
    mutationFn: async () => {
      const mediaPath = mode === "upload" ? (file ? await uploadRecording(file, "reference") : null) : null;
      if (mode === "upload" && !mediaPath) throw new Error("Choose a recording.");
      return add({ data: { title: title.trim() || "Model call", mediaPath, mediaUrl: mode === "drive" ? link.trim() : null } });
    },
    onSuccess: () => { notify.success("Model call added", "Transcribing now."); setTitle(""); setFile(null); setLink(""); qc.invalidateQueries({ queryKey: KEY }); },
    onError: (e: Error) => notify.error("Couldn't add", e.message),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const promote = useServerFn(promoteReviewToReference);
  const pm = useMutation({
    mutationFn: (reviewId: string) => promote({ data: { reviewId } }),
    onSuccess: () => { notify.success("Model call added", "It's now part of the Gold Standard."); refresh(); },
    onError: (e: Error) => notify.error("Couldn't add", e.message),
  });
  return (
    <Panel title="Model calls" description="Your best calls. The 3 newest active ones are used as examples of how a call should sound.">
      <div className="space-y-4">
        <div className="space-y-3 rounded-md border border-border p-3">
          <Field label="Call name"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. KJ — veteran close" /></Field>
          <MediaPicker mode={mode} setMode={setMode} file={file} setFile={setFile} link={link} setLink={setLink} />
          <Button variant="primary" loading={m.isPending} disabled={mode === "upload" ? !file : !link.trim()} onClick={() => m.mutate()}>Add model call</Button>
        </div>
        {candidates.length > 0 && (
          <div className="rounded-md border border-border p-3">
            <div className="p-label mb-1">Reuse an already-analyzed call</div>
            <p className="mb-2 text-[12.5px] text-muted-foreground">Any call that's been scored already has a transcript — add it as a model call without re-uploading.</p>
            <div className="space-y-2">
              {candidates.map((r: any) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-[13.5px]">
                  <span className="flex-1 font-medium">{r.title}</span>
                  <span className="text-[12px] text-muted-foreground">{r.call_type === "live" ? "Live call" : "Roleplay"} · {new Date(r.created_at).toLocaleDateString()}{r.overall != null ? ` · scored ${r.overall}` : ""}</span>
                  <Button size="sm" loading={pm.isPending && pm.variables === r.id} onClick={() => pm.mutate(r.id)}>Use as model call</Button>
                </div>
              ))}
            </div>
          </div>
        )}
        {calls.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3 text-[13.5px]">
            <span className="flex-1 font-medium">{c.title}</span>
            <StatusBadge status={c.status} />
            {c.status === "failed" && <><span className="w-full text-[12px] text-destructive">{c.error}</span><Button size="sm" onClick={async () => { await upd({ data: { id: c.id, retry: true } }); refresh(); }}>Retry</Button></>}
            <Toggle checked={c.is_active} onChange={async (v: boolean) => { await upd({ data: { id: c.id, isActive: v } }); refresh(); }} label="Active" />
            <Button size="sm" variant="ghost" aria-label="Remove model call" onClick={async () => { if (confirm("Remove this model call?")) { await upd({ data: { id: c.id, remove: true } }); refresh(); } }}><Trash2 size={14} aria-hidden /></Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Scoring({ settings }: { settings: any }) {
  const qc = useQueryClient();
  const save = useServerFn(saveCoachSettings);
  const [weights, setWeights] = useState<Record<string, number>>(() => Object.fromEntries(PILLARS.map((p) => [p.key, settings.weights?.[p.key] ?? 1])));
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(PILLARS.map((p) => [p.key, settings.rubric_notes?.[p.key] ?? ""])));
  const [minScore, setMinScore] = useState<string>(settings.min_score_for_approval?.toString() ?? "");
  const m = useMutation({
    mutationFn: () => save({ data: { weights, rubricNotes: notes, minScore: minScore.trim() ? Math.max(0, Math.min(100, Number(minScore))) : null } }),
    onSuccess: () => { notify.success("Scoring saved"); qc.invalidateQueries({ queryKey: KEY }); },
    onError: (e: Error) => notify.error("Couldn't save", e.message),
  });
  return (
    <Panel title="Scoring" description="Weight each pillar (0 = ignore, 1 = normal, up to 5) and describe what a 10 looks like.">
      <div className="space-y-3">
        {PILLARS.map((p) => (
          <div key={p.key} className="grid gap-2 sm:grid-cols-[140px_90px_1fr] sm:items-center">
            <span className="text-[14px] font-medium">{p.label}</span>
            <Input type="number" min={0} max={5} step={0.5} value={weights[p.key]} onChange={(e) => setWeights({ ...weights, [p.key]: Number(e.target.value) || 0 })} aria-label={`${p.label} weight`} />
            <Input placeholder="What a 10 looks like (optional)" value={notes[p.key]} onChange={(e) => setNotes({ ...notes, [p.key]: e.target.value })} aria-label={`${p.label} rubric`} />
          </div>
        ))}
        <Field label="Suggested minimum Coach score for homework approval (optional)" hint="Shown to reviewers as a guide. Nothing is approved automatically.">
          <Input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="e.g. 70" />
        </Field>
        <div className="flex items-center gap-2"><Button variant="primary" loading={m.isPending} onClick={() => m.mutate()}>Save scoring</Button><Badge>Overall = weighted average × 10</Badge></div>
      </div>
    </Panel>
  );
}
