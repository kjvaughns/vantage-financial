import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { getDashboard, getMyOnboarding } from "@/lib/portal.functions";
import { RecruitingLinkCard } from "@/components/vantage/recruiting-link-card";
import { ONBOARDING_STEP_ORDER } from "@/lib/onboarding";
import {
  PageHeader,
  PageBody,
  Panel,
  MetricRow,
  MetricCard,
  Badge,
  Button,
  EmptyState,
  CardSkeleton,
  MetricSkeleton,
} from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({ meta: [{ title: "Dashboard — Vantage Portal" }, { name: "description", content: "Your Vantage recruiting activity, onboarding progress and assistant support." }, { property: "og:title", content: "Dashboard — Vantage Portal" }, { property: "og:description", content: "Your Vantage recruiting activity and team support." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const fn = useServerFn(getDashboard);
  const navigate = useNavigate();
  const onbFn = useServerFn(getMyOnboarding);
  const onbQ = useQuery({ queryKey: ["my-onboarding"], queryFn: () => onbFn() });

  // Soft landing: a new agent with incomplete onboarding defaults to the
  // onboarding page. They can still navigate elsewhere from the sidebar.
  const needsOnboarding = !!onbQ.data?.hasOnboarding && !onbQ.data.complete;
  useEffect(() => {
    if (needsOnboarding) navigate({ to: "/portal/onboarding", replace: true });
  }, [needsOnboarding, navigate]);

  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });

  // Onboarding progress card (reuses the my-onboarding query). Ternaries keep the
  // discriminated-union narrowing that a closure would lose.
  const onb = onbQ.data;
  const onbDone = onb?.hasOnboarding ? onb.done ?? 0 : 0;
  const onbTotal = onb?.hasOnboarding ? onb.total ?? ONBOARDING_STEP_ORDER.length : ONBOARDING_STEP_ORDER.length;
  const onbComplete = onb?.hasOnboarding ? !!onb.complete : false;
  const onbPct = Math.round((onbDone / onbTotal) * 100);

  if (needsOnboarding) {
    return (
      <PortalShell>
        <PageBody>
          <PageHeader title="Getting you set up…" description="Welcome to Vantage" />
          <div className="p-secondary">Taking you to your onboarding checklist…</div>
        </PageBody>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <PageBody>
        <PageHeader
          title="Dashboard"
          description="Your recruiting activity, pipeline, and recent events."
          actions={
            <Link to="/portal/applicants">
              <Button variant="primary" size="sm">Open Applicants →</Button>
            </Link>
          }
        />

        {isLoading ? (
          <SkeletonGrid />
        ) : (
          <div className="space-y-4">
            <RecruitingLinkCard />

            {onb?.hasOnboarding && (
              <Panel
                title="Your onboarding"
                actions={
                  <Link to="/portal/onboarding">
                    <Button variant="secondary" size="sm">View checklist →</Button>
                  </Link>
                }
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="p-label">
                    {onbComplete ? "All steps complete" : `${onbDone} of ${onbTotal} complete`}
                  </span>
                  {onbComplete ? (
                    <Badge tone="green">Complete</Badge>
                  ) : (
                    <span className="p-metric" style={{ color: "var(--p-gold)" }}>
                      {onbPct}%
                    </span>
                  )}
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--p-hover)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.max(4, onbPct)}%`, background: "var(--p-gold)" }}
                  />
                </div>
              </Panel>
            )}

            <MetricRow>
              <MetricCard label="My Applicants" value={data?.counts.totalMine ?? 0} hint="Active in your book" />
              <MetricCard label="New This Week" value={data?.counts.newThisWeek ?? 0} hint="Fresh applicants" accent />
              <MetricCard label="Scheduled" value={data?.counts.scheduled30d ?? 0} hint="Overviews booked · 30d" />
              <MetricCard label="Evaluated" value={data?.counts.evaluated30d ?? 0} hint="Completed · 30d" />
            </MetricRow>

            {(data?.needsFollowUp ?? []).length > 0 && (
              <Panel
                title="Needs follow-up this week"
                description="Hired but not yet licensed, and it's been more than a week (or never) since their last check-in."
                actions={
                  <Link to="/portal/applicants" className="p-secondary text-[12px] hover:underline">
                    Open Pre-Licensing →
                  </Link>
                }
                bodyClassName="p-0"
              >
                <div>
                  {(data?.needsFollowUp ?? []).map((p) => {
                    const days = p.last_follow_up_at ? daysSince(p.last_follow_up_at) : null;
                    return (
                      <Link
                        key={p.id}
                        to="/portal/applicants/$applicantId"
                        params={{ applicantId: p.id }}
                        className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-[13.5px] transition last:border-b-0 hover:bg-[var(--p-hover)]"
                        style={{ borderColor: "var(--p-border)" }}
                      >
                        <span className="truncate">
                          {p.first_name} {p.last_name}
                        </span>
                        <Badge tone="red">
                          {days === null ? "Never followed up" : `${days}d overdue`}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              </Panel>
            )}

            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <Panel
                title="Pipeline snapshot"
                actions={
                  <Link to="/portal/pipeline" className="p-secondary text-[12px] hover:underline">
                    View pipeline →
                  </Link>
                }
              >
                <div className="grid gap-2">
                  {(data?.stages ?? []).map((s) => {
                    const count = data?.stageCounts[s.id] ?? 0;
                    const max = Math.max(1, ...Object.values(data?.stageCounts ?? {}));
                    const pct = Math.max(4, (count / max) * 100);
                    return (
                      <div key={s.id} className="flex items-center gap-3">
                        <div className="w-32 flex-none truncate text-[13px]" style={{ color: "var(--p-text-2)" }}>
                          {s.name}
                        </div>
                        <div
                          className="relative h-2 flex-1 overflow-hidden rounded-full"
                          style={{ background: "var(--p-hover)" }}
                        >
                          <div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ width: `${pct}%`, background: s.color || "var(--p-gold)" }}
                          />
                        </div>
                        <div className="w-8 flex-none text-right p-metric text-[16px]">{count}</div>
                      </div>
                    );
                  })}
                  {(data?.stages ?? []).length === 0 && (
                    <EmptyState title="No pipeline stages" description="No pipeline stages configured yet." />
                  )}
                </div>
              </Panel>

              <Panel title="Recent activity">
                <div className="flex flex-col gap-3">
                  {(data?.feed ?? []).slice(0, 12).map((f) => {
                    const app = f.applicants as { first_name: string; last_name: string } | null;
                    const who = app ? `${app.first_name} ${app.last_name}` : "Applicant";
                    return (
                      <div
                        key={f.id}
                        className="flex items-start gap-3 border-b pb-3 last:border-0"
                        style={{ borderColor: "var(--p-border)" }}
                      >
                        <div
                          className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full"
                          style={{ background: "var(--p-gold)" }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px]">
                            <span style={{ color: "var(--p-gold)" }}>{eventLabel(f.event_type)}</span> — {who}
                          </div>
                          {f.summary && <div className="p-muted mt-0.5 truncate">{f.summary}</div>}
                        </div>
                        <div className="p-muted shrink-0 text-[11px]">{relative(f.created_at)}</div>
                      </div>
                    );
                  })}
                  {(data?.feed ?? []).length === 0 && (
                    <EmptyState
                      title="No activity yet"
                      description="Once applicants come in, they'll show up here."
                    />
                  )}
                </div>
              </Panel>
            </div>
          </div>
        )}
      </PageBody>
    </PortalShell>
  );
}

/** Mirrors the real dashboard: link panel, metric row, then the two columns. */
function SkeletonGrid() {
  return (
    <div className="space-y-4">
      <CardSkeleton lines={1} />
      <MetricRow>
        {[0, 1, 2, 3].map((i) => (
          <MetricSkeleton key={i} />
        ))}
      </MetricRow>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={5} />
      </div>
    </div>
  );
}

function eventLabel(t: string) {
  const map: Record<string, string> = {
    application_submitted: "New application",
    evaluation_submitted: "Evaluation submitted",
    appointment_scheduled: "Appointment scheduled",
    stage_changed: "Stage updated",
    note: "Note added",
  };
  return map[t] ?? t.replace(/_/g, " ");
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
}

function relative(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  return `${dd}d`;
}
