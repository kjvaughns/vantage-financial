import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { getMe } from "@/lib/portal.functions";
import { adminListRecordings, adminListLibraryV2 } from "@/lib/academy-content.functions";
import { adminListCourses } from "@/lib/academy.functions";
import { syncTranscription } from "@/lib/academy-media.functions";
import { RecordingsManager } from "@/components/vantage/academy/recordings-manager";
import { LibraryManager } from "@/components/vantage/academy/library-manager";
import { CoursesManager } from "@/components/vantage/academy/courses-manager";
import { TemplatesManager } from "@/components/vantage/academy/templates-manager";
import {
  PageHeader,
  PageBody,
  Panel,
  Badge,
  Button,
  Modal,
  Input,
  EmptyState,
  CardSkeleton,
  } from "@/components/portal/ui";
import { ChevronLeft, PlayCircle, BookOpen, GraduationCap, Plus, Search, LayoutTemplate } from "lucide-react";

type Section = "overview" | "recordings" | "library" | "courses" | "templates";

export const Route = createFileRoute("/_authenticated/portal/academy/admin")({
  head: () => ({
    meta: [
      { title: "Academy management — Vantage Portal" },
      { name: "description", content: "Manage recorded presentations, the resource library and agent courses." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcademyAdmin,
});

function AcademyAdmin() {
  const meFn = useServerFn(getMe);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const roles = meQ.data?.roles ?? [];
  const profile = meQ.data?.profile as any;
  const canManage = roles.some((r) => r === "admin" || r === "super_admin") || !!profile?.can_manage_resources;
  const [section, setSection] = useState<Section>("overview");
  const [autoNew, setAutoNew] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [picker, setPicker] = useState(false);
  const go = (s: Section, openNew = false) => {
    setAutoNew(openNew);
    setSection(s);
    setNonce((n) => n + 1);
  };

  if (meQ.isLoading)
    return (
      <PortalShell>
        <PageBody>
          <CardSkeleton lines={4} />
        </PageBody>
      </PortalShell>
    );

  if (!canManage)
    return (
      <PortalShell>
        <PageBody>
          <EmptyState
            title="Not permitted"
            description="Only admins and leaders with Academy access can manage this content."
          />
        </PageBody>
      </PortalShell>
    );

  return (
    <PortalShell>
      <PageBody>
        <Link
          to="/portal/academy"
          className="p-focus mb-3 inline-flex items-center gap-1 text-[13px]"
          style={{ color: "var(--p-text-2)" }}
        >
          <ChevronLeft size={15} /> Academy
        </Link>
        <PageHeader
          title="Academy management"
          description="Add presentations, resources and courses in a couple of clicks."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => go("templates")}>
                <LayoutTemplate size={13} /> Templates
              </Button>
              <Button variant="primary" onClick={() => setPicker(true)}>
                <Plus size={15} /> Add to Academy
              </Button>
            </div>
          }
        />

        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Content type">
          {CHIPS.map((c) => (
            <button
              key={c.value}
              role="tab"
              aria-selected={section === c.value}
              onClick={() => go(c.value)}
              className="p-focus h-8 rounded-full border px-3.5 text-[13px] transition"
              style={
                section === c.value
                  ? { borderColor: "var(--p-gold)", background: "var(--p-gold-soft, var(--p-hover))", color: "var(--p-gold)" }
                  : { borderColor: "var(--p-border)", background: "var(--p-raised)", color: "var(--p-text-2)" }
              }
            >
              {c.label}
            </button>
          ))}
        </div>

        <div key={`${section}-${nonce}`}>
          {section === "overview" && <AllContent onGo={go} onAdd={() => setPicker(true)} />}
          {section === "recordings" && <RecordingsManager initialNew={autoNew} />}
          {section === "library" && <LibraryManager initialNew={autoNew} />}
          {section === "courses" && <CoursesManager initialNew={autoNew} />}
          {section === "templates" && (
            <TemplatesManager
              onApplied={(kind) => go(kind === "course" ? "courses" : kind === "library" ? "library" : "recordings")}
            />
          )}
        </div>

        {picker && (
          <Modal
            title="What do you want to add?"
            description="Pick one — you'll get a short form. Recordings transcribe automatically when you save."
            onClose={() => setPicker(false)}
            width={720}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {ADD_CARDS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => {
                    setPicker(false);
                    go(c.key, true);
                  }}
                  className="p-focus group flex flex-col items-start gap-2 rounded-[14px] border p-4 text-left transition hover:-translate-y-0.5"
                  style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}
                >
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[12px]"
                    style={{ background: "var(--p-hover)", color: "var(--p-gold)" }}
                  >
                    <c.icon size={20} aria-hidden />
                  </span>
                  <span className="text-[15px] font-semibold" style={{ color: "var(--p-text)" }}>{c.label}</span>
                  <span className="p-secondary leading-snug">{c.blurb}</span>
                </button>
              ))}
            </div>
          </Modal>
        )}
      </PageBody>
    </PortalShell>
  );
}

const CHIPS: { value: Section; label: string }[] = [
  { value: "overview", label: "All content" },
  { value: "recordings", label: "Presentations" },
  { value: "library", label: "Resources" },
  { value: "courses", label: "Courses" },
];

const ADD_CARDS: { key: Section; label: string; icon: any; blurb: string }[] = [
  { key: "recordings", label: "Presentation", icon: PlayCircle, blurb: "A training or call recording. Paste a Drive or video link." },
  { key: "library", label: "Resource", icon: BookOpen, blurb: "A script, playbook, document, link or file." },
  { key: "courses", label: "Course", icon: GraduationCap, blurb: "Modules and lessons with progress tracking." },
];

const TYPE_LABEL: Record<string, string> = { recordings: "Presentation", library: "Resource", courses: "Course" };

function AllContent({ onGo, onAdd }: { onGo: (s: Section) => void; onAdd: () => void }) {
  const recFn = useServerFn(adminListRecordings);
  const libFn = useServerFn(adminListLibraryV2);
  const courseFn = useServerFn(adminListCourses);
  const recQ = useQuery({
    queryKey: ["academy", "admin", "recordings"],
    queryFn: () => recFn(),
    refetchInterval: (q) => (hasActive((q.state.data as any)?.recordings) ? 10000 : false),
  });
  const libQ = useQuery({
    queryKey: ["academy", "admin", "library"],
    queryFn: () => libFn(),
    refetchInterval: (q) => (hasActive((q.state.data as any)?.resources) ? 10000 : false),
  });
  const courseQ = useQuery({ queryKey: ["academy", "courses"], queryFn: () => courseFn() });
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState(false);
  useTranscriptSync([
    ...((recQ.data?.recordings ?? []) as any[]).map((r) => ({ type: "recording" as const, r })),
    ...((libQ.data?.resources ?? []) as any[]).map((r) => ({ type: "library" as const, r })),
  ]);

  const rows = useMemo(() => {
    const all = [
      ...((recQ.data?.recordings ?? []) as any[]).map((r) => ({ kind: "recordings" as Section, r, status: r.status, tx: r.transcript?.status })),
      ...((libQ.data?.resources ?? []) as any[]).map((r) => ({ kind: "library" as Section, r, status: r.status, tx: r.transcript?.status })),
      ...((courseQ.data?.courses ?? []) as any[]).map((r) => ({ kind: "courses" as Section, r, status: r.status, tx: undefined })),
    ];
    const needle = query.trim().toLowerCase();
    return all
      .filter((x) => (!drafts || (x.status ?? "draft") !== "published"))
      .filter((x) => !needle || String(x.r.title ?? "").toLowerCase().includes(needle))
      .sort((a, b) => String(b.r.created_at ?? "").localeCompare(String(a.r.created_at ?? "")));
  }, [recQ.data, libQ.data, courseQ.data, query, drafts]);

  const loading = recQ.isLoading || libQ.isLoading || courseQ.isLoading;

  return (
    <Panel padded={false} title="Everything in the Academy" description="Newest first. Click any row to edit it.">
      <div className="flex flex-wrap items-center gap-2 p-4 pb-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--p-text-3)" }} />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles…" className="pl-8" />
        </div>
        <Button variant={drafts ? "primary" : "secondary"} size="sm" onClick={() => setDrafts((v) => !v)}>
          Drafts only
        </Button>
      </div>
      {loading ? (
        <div className="p-4"><CardSkeleton lines={4} /></div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title={query || drafts ? "Nothing matches" : "Nothing here yet"}
            description="Add your first presentation, resource or course."
            action={<Button variant="primary" size="sm" onClick={onAdd}><Plus size={14} /> Add to Academy</Button>}
          />
        </div>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--p-border)" }}>
          {rows.map((x) => (
            <li key={`${x.kind}-${x.r.id}`}>
              <button
                onClick={() => onGo(x.kind)}
                className="p-focus flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--p-hover)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]" style={{ color: "var(--p-text)" }}>{x.r.title}</span>
                  <span className="p-muted text-[12px]">{TYPE_LABEL[x.kind]}</span>
                </span>
                {x.tx === "queued" || x.tx === "processing" ? (
                  <Badge tone="amber">Transcribing…</Badge>
                ) : x.tx === "completed" ? (
                  <Badge tone="blue">Transcript ready</Badge>
                ) : x.tx === "failed" ? (
                  <Badge tone="red">Transcript failed</Badge>
                ) : null}
                <Badge tone={x.status === "published" ? "green" : "neutral"}>{x.status ?? "draft"}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function hasActive(list: any[] | undefined) {
  return (list ?? []).some((r) => r?.transcript?.status === "queued" || r?.transcript?.status === "processing");
}

/** Advance in-flight transcription jobs while the list is open. */
function useTranscriptSync(items: { type: "recording" | "library"; r: any }[]) {
  const syncFn = useServerFn(syncTranscription);
  const qc = useQueryClient();
  const active = items.filter((i) => i.r?.transcript?.status === "queued" || i.r?.transcript?.status === "processing");
  const key = active.map((a) => a.r.id).join(",");
  useEffect(() => {
    if (!key) return;
    const tick = async () => {
      await Promise.all(
        active.map((a) => syncFn({ data: { owner_type: a.type, owner_id: a.r.id } }).catch(() => null)),
      );
      qc.invalidateQueries({ queryKey: ["academy", "admin"] });
    };
    const id = window.setInterval(tick, 15000);
    void tick();
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

