import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PortalShell } from "@/components/vantage/portal-shell";
import { getMe } from "@/lib/portal.functions";
import { getAcademyHome } from "@/lib/academy.functions";
import { listRecordingsLearner } from "@/lib/academy-content.functions";
import { NewContentBadge } from "@/components/vantage/new-content-badge";
import {
  PageHeader,
  PageBody,
  Panel,
  Badge,
  Button,
  Toolbar,
  SearchField,
  EmptyState,
  ErrorState,
  Select,
  CardSkeleton,
  Avatar,
} from "@/components/portal/ui";
import { Video, Headphones, FileText, Link2, GraduationCap, PlayCircle, ChevronLeft } from "lucide-react";

const searchSchema = z.object({
  section: z.enum(["presentations", "courses", "library"]).optional(),
  speaker: z.string().max(200).optional(),
});


export const Route = createFileRoute("/_authenticated/portal/academy/")({
  head: () => ({ meta: [{ title: "Academy — Vantage Portal" }, { name: "description", content: "Vantage courses, recorded presentations and agent resources." }, { property: "og:title", content: "Academy — Vantage Portal" }, { property: "og:description", content: "Courses, presentations and resources for Vantage agents." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: AcademyHome,
});

type ResType = "video" | "audio" | "file" | "link";
const TYPE_ICON: Record<ResType, typeof Video> = { video: Video, audio: Headphones, file: FileText, link: Link2 };
function typeIcon(type: string, size: number) {
  const Icon = TYPE_ICON[(type as ResType) in TYPE_ICON ? (type as ResType) : "link"];
  return <Icon size={size} />;
}

function AcademyHome() {
  const { section, speaker } = Route.useSearch();
  const homeFn = useServerFn(getAcademyHome);
  const recFn = useServerFn(listRecordingsLearner);
  const meFn = useServerFn(getMe);
  const q = useQuery({ queryKey: ["academy", "home"], queryFn: () => homeFn() });
  const recQ = useQuery({ queryKey: ["academy", "recordings"], queryFn: () => recFn() });
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const canManage =
    (meQ.data?.roles ?? []).some((r) => r === "admin" || r === "super_admin") ||
    !!(meQ.data?.profile as any)?.can_manage_resources;

  const courses = (q.data?.courses ?? []) as any[];
  const resources = (q.data?.resources ?? []) as any[];
  const presentations = (recQ.data?.recordings ?? []) as any[];
  const library = resources.filter((r) => r.section !== "presentation" && (r.status ?? "published") !== "draft");


  const manageBtn = canManage ? (
    <Link to="/portal/academy/admin"><Button variant="secondary" size="sm">Manage Academy</Button></Link>
  ) : undefined;

  const back = (
    <Link to="/portal/academy" className="p-focus mb-4 inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--p-text-2)" }}>
      <ChevronLeft size={15} /> Academy
    </Link>
  );

  if (q.isError) {
    return (
      <PortalShell>
        <PageBody>
          <ErrorState description="We couldn't load the Academy right now. Please try again." onRetry={() => q.refetch()} />
        </PageBody>
      </PortalShell>
    );
  }

  if (q.isLoading) {
    return (
      <PortalShell>
        <PageBody>
          <PageHeader title="Vantage Academy" description="Everything you need to learn, sell, and grow at Vantage." />
          <div className="grid gap-4 md:grid-cols-3">
            <CardSkeleton lines={2} />
            <CardSkeleton lines={2} />
            <CardSkeleton lines={2} />
          </div>
        </PageBody>
      </PortalShell>
    );
  }

  if (section === "presentations") {
    const speakers = new Map<string, { slug: string; name: string; role: string | null; photo_url: string | null; count: number; created_at: string | null }>();
    for (const r of presentations) {
      const p = r.presenter;
      const key = p?.slug || p?.id || "unknown";
      const existing = speakers.get(key);
      if (existing) {
        existing.count += 1;
        if (r.created_at && (!existing.created_at || r.created_at > existing.created_at)) existing.created_at = r.created_at;
      }
      else
        speakers.set(key, {
          slug: key,
          name: p?.name ?? "Vantage team",
          role: p?.role ?? null,
          photo_url: p?.photo_url ?? null,
          count: 1,
          created_at: r.created_at ?? null,
        });
    }
    const speakerList = Array.from(speakers.values()).sort((a, b) => a.name.localeCompare(b.name));
    const active = speaker ? speakers.get(speaker) : undefined;

    if (speaker) {
      const mine = presentations.filter((r) => (r.presenter?.slug || r.presenter?.id || "unknown") === speaker);
      return (
        <PortalShell>
          <PageBody>
            <Link
              to="/portal/academy"
              search={{ section: "presentations" }}
              className="p-focus mb-4 inline-flex items-center gap-1 text-[13px]"
              style={{ color: "var(--p-text-2)" }}
            >
              <ChevronLeft size={15} /> Speakers
            </Link>
            <PageHeader
              title={active?.name ?? "Speaker"}
              description={active?.role ?? "Recorded trainings from this speaker."}
              actions={manageBtn}
            />
            {mine.length === 0 ? (
              <Panel>
                <EmptyState title="No recordings yet" description="This speaker doesn't have published recordings yet." />
              </Panel>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mine.map((r) => <PresentationCard key={r.id} r={r} />)}
              </div>
            )}
          </PageBody>
        </PortalShell>
      );
    }

    return (
      <PortalShell>
        <PageBody>
          {back}
          <PageHeader title="Recorded Presentations" description="Pick a speaker to see their trainings and call breakdowns." actions={manageBtn} />
          {speakerList.length === 0 ? (
            <Panel>
              <EmptyState
                title="No recordings yet"
                description="Recorded trainings and call breakdowns will show up here once they're published."
              />
            </Panel>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {speakerList.map((s) => <SpeakerCard key={s.slug} s={s} />)}
            </div>
          )}
        </PageBody>
      </PortalShell>
    );
  }


  if (section === "courses") {
    return (
      <PortalShell>
        <PageBody>
          {back}
          <PageHeader title="Courses" description="Structured Vantage training programs." actions={manageBtn} />
          {courses.length === 0 ? (
            <Panel>
              <EmptyState
                title="No courses yet"
                description="Structured training programs will appear here once they're published."
              />
            </Panel>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => <CourseCard key={c.id} c={c} />)}
            </div>
          )}
        </PageBody>
      </PortalShell>
    );
  }

  if (section === "library") {
    return (
      <PortalShell>
        <PageBody>
          {back}
          <PageHeader title="Library" description="Scripts, PDFs, guides, videos, and resources." actions={manageBtn} />
          <LibrarySection resources={library} />
        </PageBody>
      </PortalShell>
    );
  }

  // Hub
  return (
    <PortalShell>
      <PageBody>
        <PageHeader
          title="Vantage Academy"
          description="Everything you need to learn, sell, and grow at Vantage."
          actions={manageBtn}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <HubCard
            to="presentations"
            icon={<PlayCircle size={18} />}
            title="Recorded Presentations"
            desc="Watch previous trainings and call breakdowns."
            count={presentations.length}
            createdAt={latestContentDate(presentations)}
          />
          <HubCard
            to="courses"
            icon={<GraduationCap size={18} />}
            title="Courses"
            desc="Complete structured Vantage training programs."
            count={courses.length}
            createdAt={latestContentDate(courses)}
          />
          <HubCard
            to="library"
            icon={<FileText size={18} />}
            title="Library"
            desc="Access scripts, PDFs, guides, videos, and resources."
            count={library.length}
            createdAt={latestContentDate(library)}
          />
        </div>
      </PageBody>
    </PortalShell>
  );
}

function latestContentDate(items: { created_at?: string | null }[]) {
  return items.flatMap((item) => item.created_at ? [item.created_at] : []).sort().at(-1) ?? null;
}

function HubCard({ to, icon, title, desc, count, createdAt }: { to: "presentations" | "courses" | "library"; icon: React.ReactNode; title: string; desc: string; count: number; createdAt: string | null }) {
  return (
    <Link to="/portal/academy" search={{ section: to }} className="p-panel flex flex-col gap-2 p-4 transition hover:[border-color:var(--p-border-strong)]">
      <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: "var(--p-raised)", color: "var(--p-gold)" }}>{icon}</span>
      <div className="flex flex-wrap items-center gap-2"><h2 className="p-card-title mt-1">{title}</h2><NewContentBadge createdAt={createdAt} /></div>
      <p className="p-secondary leading-snug">{desc}</p>
      <div className="mt-auto pt-2"><span className="p-muted">{count} {count === 1 ? "item" : "items"}</span></div>
    </Link>
  );
}

function CourseCard({ c }: { c: any }) {
  return (
    <Link to="/portal/academy/courses/$slug" params={{ slug: c.slug }} className="p-panel flex flex-col gap-2 p-4 transition hover:[border-color:var(--p-border-strong)]">
      <div className="flex items-start justify-between gap-2">
        <span className="p-card-title">{c.title}</span>
        <div className="flex shrink-0 flex-wrap gap-1"><NewContentBadge createdAt={c.created_at} />{c.is_required && <Badge tone="gold">Required</Badge>}</div>
      </div>
      {c.instructor_name && <span className="p-muted">{c.instructor_name}</span>}
      {c.description && <p className="p-secondary leading-snug">{c.description}</p>}
      <div className="mt-auto pt-2">
        {c.progress === null ? (
          <span className="p-muted">Not started</span>
        ) : c.completed ? (
          <Badge tone="green">Completed</Badge>
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between">
              <span className="p-muted">Progress</span>
              <span className="p-muted">{c.progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--p-hover)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(3, c.progress)}%`, background: "var(--p-gold)" }} />
            </div>
          </>
        )}
      </div>
    </Link>
  );
}

function PresentationCard({ r }: { r: any }) {
  return (
    <Link
      to="/portal/academy/presentations/$slug"
      params={{ slug: r.slug }}
      className="p-panel overflow-hidden transition hover:[border-color:var(--p-border-strong)]"
    >
      {r.thumbnail_url ? (
        <img src={r.thumbnail_url} alt={`${r.title} cover`} loading="lazy" className="aspect-video w-full object-cover" />
      ) : (
        <div className="grid aspect-video place-items-center" style={{ background: "var(--p-raised)", color: "var(--p-gold)" }}>
          {r.format === "audio" ? <Headphones size={30} /> : <PlayCircle size={34} />}
        </div>
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="p-card-title truncate">{r.title}</div>
          <NewContentBadge createdAt={r.created_at} />
        </div>
        <div className="p-muted mt-0.5 truncate">
          {[r.presenter?.name, r.topic, r.duration].filter(Boolean).join(" · ")}
        </div>
        {r.description && <p className="p-secondary mt-1 line-clamp-2 leading-snug">{r.description}</p>}
      </div>
    </Link>
  );
}


function LibrarySection({ resources }: { resources: any[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const categories = useMemo(
    () => Array.from(new Set(resources.map((r) => r.category).filter(Boolean))).sort() as string[],
    [resources],
  );
  const filtered = resources.filter((r) => {
    const matchesQ = !search.trim() || r.title.toLowerCase().includes(search.trim().toLowerCase());
    const matchesCat = !category || r.category === category;
    return matchesQ && matchesCat;
  });

  return (
    <>
      <Toolbar className="mb-3">
        <SearchField value={search} onChange={setSearch} placeholder="Search the library…" />
        {categories.length > 0 && (
          <Select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 w-full text-[13px] sm:w-auto"
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        )}
      </Toolbar>
      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            title="No resources match those filters"
            description="Try a different search term or clear the category filter."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <Link key={r.id} to="/portal/academy/library/$slug" params={{ slug: r.slug }} className="p-panel flex flex-col gap-2 p-4 transition hover:[border-color:var(--p-border-strong)]">
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-[8px]" style={{ background: "var(--p-raised)", color: "var(--p-gold)" }}>{typeIcon(r.type, 15)}</span>
                <div className="flex flex-wrap gap-1"><NewContentBadge createdAt={r.created_at} />{r.is_required && <Badge tone="gold">Required</Badge>}</div>
              </div>
              <span className="p-card-title">{r.title}</span>
              {r.description && <p className="p-secondary leading-snug">{r.description}</p>}
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <span className="p-muted capitalize">{r.type}</span>
                {r.category && <span className="p-muted truncate">{r.category}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function SpeakerCard({ s }: { s: { slug: string; name: string; role: string | null; photo_url: string | null; count: number; created_at: string | null } }) {
  return (
    <Link
      to="/portal/academy"
      search={{ section: "presentations", speaker: s.slug }}
      className="p-panel flex items-center gap-3 p-4 transition hover:[border-color:var(--p-border-strong)]"
    >
      {s.photo_url ? (
        <img src={s.photo_url} alt={`${s.name} headshot`} loading="lazy" className="h-12 w-12 shrink-0 rounded-full object-cover" />
      ) : (
        <Avatar name={s.name} size={48} />
      )}
      <div className="min-w-0">
        <div className="p-card-title truncate">{s.name}</div>
        <NewContentBadge createdAt={s.created_at} />
        {s.role && <div className="p-muted truncate">{s.role}</div>}
        <div className="p-muted mt-0.5">{s.count} {s.count === 1 ? "recording" : "recordings"}</div>
      </div>
    </Link>
  );
}
