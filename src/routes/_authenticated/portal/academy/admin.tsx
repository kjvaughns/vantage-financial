import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { getMe } from "@/lib/portal.functions";
import { getAcademyAdminSummary } from "@/lib/academy-content.functions";
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
  SegmentedControl,
  EmptyState,
  CardSkeleton,
  MetricRow,
  MetricCard,
} from "@/components/portal/ui";
import { ChevronLeft, PlayCircle, BookOpen, GraduationCap } from "lucide-react";

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
          description="Everything agents learn lives here: recorded presentations, the library and courses."
          actions={
            <SegmentedControl
              value={section}
              onChange={setSection}
              options={[
                { value: "overview", label: "Overview" },
                { value: "recordings", label: "Recordings" },
                { value: "library", label: "Library" },
                { value: "courses", label: "Courses" },
                { value: "templates", label: "Templates" },
              ]}
            />
          }
        />

        {section === "overview" && <Overview onGo={setSection} />}
        {section === "recordings" && <RecordingsManager />}
        {section === "library" && <LibraryManager />}
        {section === "courses" && <CoursesManager />}
        {section === "templates" && (
          <TemplatesManager
            onApplied={(kind) =>
              setSection(kind === "course" ? "courses" : kind === "library" ? "library" : "recordings")
            }
          />
        )}
      </PageBody>
    </PortalShell>
  );
}

function Overview({ onGo }: { onGo: (s: Section) => void }) {
  const sumFn = useServerFn(getAcademyAdminSummary);
  const q = useQuery({ queryKey: ["academy", "admin", "summary"], queryFn: () => sumFn() });
  const s = q.data as any;

  const cards: { key: Section; label: string; icon: any; blurb: string; data: any }[] = [
    { key: "recordings", label: "Recorded presentations", icon: PlayCircle, blurb: "Trainings and calls agents watch on demand.", data: s?.recordings },
    { key: "library", label: "Library", icon: BookOpen, blurb: "Scripts, playbooks and reference documents.", data: s?.library },
    { key: "courses", label: "Courses", icon: GraduationCap, blurb: "Structured lessons with quizzes and progress.", data: s?.courses },
  ];

  return (
    <div className="space-y-4">
      <MetricRow>
        <MetricCard label="Published recordings" value={s?.recordings?.published ?? "—"} />
        <MetricCard label="Published library items" value={s?.library?.published ?? "—"} />
        <MetricCard label="Published courses" value={s?.courses?.published ?? "—"} />
        <MetricCard
          label="Drafts waiting"
          value={
            s ? (s.recordings.drafts ?? 0) + (s.library.drafts ?? 0) + (s.courses.drafts ?? 0) : "—"
          }
        />
      </MetricRow>

      <div className="grid gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <Panel
            key={c.key}
            title={
              <span className="inline-flex items-center gap-2">
                <c.icon size={15} aria-hidden style={{ color: "var(--p-gold)" }} /> {c.label}
              </span>
            }
            actions={<Button variant="secondary" size="sm" onClick={() => onGo(c.key)}>Manage</Button>}
          >
            <p className="p-secondary leading-snug">{c.blurb}</p>
            <div className="mt-3 flex gap-2">
              <Badge tone="green">{c.data?.published ?? 0} published</Badge>
              <Badge tone="neutral">{c.data?.drafts ?? 0} drafts</Badge>
            </div>
            {(c.data?.recent ?? []).length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t pt-3" style={{ borderColor: "var(--p-border)" }}>
                {c.data.recent.map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="p-secondary truncate">{r.title}</span>
                    <Badge tone={r.status === "published" ? "green" : "neutral"}>{r.status ?? "draft"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
