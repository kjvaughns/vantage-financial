import { createFileRoute, Link } from "@tanstack/react-router";
import { formatPhone } from "@/lib/phone";
import { instagramLabel } from "@/lib/instagram";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageBody, Panel, Badge, Avatar, Button, CardSkeleton, ErrorState } from "@/components/portal/ui";
import { InterviewCalendarSettings } from "@/components/vantage/interview-calendar-settings";
import { getMe, adminGetAgentProfile } from "@/lib/portal.functions";
import { onboardingProgress, ONBOARDING_STEP_ORDER, ONBOARDING_STEP_LABELS } from "@/lib/onboarding";
import { recruitingStatusLabel, recruitingStatusTone } from "@/lib/recruiting";

export const Route = createFileRoute("/_authenticated/portal/admin/users/$userId")({
  head: () => ({ meta: [{ title: "Agent Profile — Vantage Admin" }, { name: "description", content: "Manage Vantage agent details, onboarding and team interview scheduling." }, { property: "og:title", content: "Agent Profile — Vantage Admin" }, { property: "og:description", content: "Vantage Financial agent administration and interview scheduling." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: AgentProfilePage,
});

function AgentProfilePage() {
  const { userId } = Route.useParams();
  const meFn = useServerFn(getMe);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const fn = useServerFn(adminGetAgentProfile);
  const q = useQuery({ queryKey: ["admin", "agent", userId], queryFn: () => fn({ data: { user_id: userId } }) });

  if (q.isLoading) {
    return (
      <PortalShell>
        <PageBody>
          <div className="mx-auto max-w-[820px] space-y-4">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={5} />
          </div>
        </PageBody>
      </PortalShell>
    );
  }

  if (q.isError) {
    return (
      <PortalShell>
        <PageBody>
          <div className="mx-auto max-w-[820px]">
            <Panel>
              <ErrorState description="We couldn't load this agent's profile." onRetry={() => q.refetch()} />
            </Panel>
          </div>
        </PageBody>
      </PortalShell>
    );
  }

  const p = q.data?.profile as any;
  const roles = q.data?.roles ?? [];
  const applicant = q.data?.applicant as any;
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || p?.email || "Agent";
  const hasOnboarding = !!applicant?.onboarding_steps;
  const { done, total } = onboardingProgress(applicant?.onboarding_steps);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const steps = (applicant?.onboarding_steps ?? {}) as Record<string, { completed?: boolean }>;

  return (
    <PortalShell>
      <PageBody>
        <div className="mx-auto max-w-[820px]">
          <Link to="/portal/admin/users" className="p-focus mb-4 inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--p-text-2)" }}>
            ← Users
          </Link>

          <div className="mb-4 flex items-center gap-3">
            <Avatar name={name} email={p?.email} src={p?.avatar_url} size={48} />
            <div className="min-w-0">
              <h1 className="p-title truncate">{name}</h1>
              <div className="p-muted truncate">{p?.email}</div>
            </div>
          </div>

          <div className="space-y-4">
            {me.data?.roles.includes("super_admin") && roles.some((r: string) => ["leader", "manager", "admin", "super_admin"].includes(r)) && p?.is_active !== false && <InterviewCalendarSettings ownerId={userId} />}
            <Panel title="Details">
              <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                <DField label="Roles" value={roles.length ? roles.join(", ") : "—"} />
                <DField label="NPN" value={p?.npn || "—"} />
                <DField label="Resident state" value={p?.resident_state || "—"} />
                <DField label="Phone" value={formatPhone(p?.phone) || "—"} />
                <DField label="Instagram" value={instagramLabel(p?.instagram_handle) || "—"} />
                <DField label="Recruiting link" value={p?.recruiting_slug || "—"} />
                <DField label="Status" value={p?.is_active === false ? "Inactive" : "Active"} />
              </dl>
            </Panel>

            <Panel
              title="Onboarding"
              actions={
                hasOnboarding ? (
                  <Badge tone={done === total ? "green" : "gold"}>{done}/{total} · {pct}%</Badge>
                ) : undefined
              }
            >
              {!hasOnboarding ? (
                <p className="p-muted">This user isn't linked to an onboarding checklist.</p>
              ) : (
                <>
                  <div className="mb-3 h-2 overflow-hidden rounded-full" style={{ background: "var(--p-hover)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(4, pct)}%`, background: "var(--p-gold)" }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    {ONBOARDING_STEP_ORDER.map((k) => {
                      const stepDone = steps[k]?.completed === true;
                      return (
                        <div key={k} className="flex items-center gap-2.5 text-[13px]">
                          <span
                            className="flex h-4 w-4 flex-none items-center justify-center rounded-full border text-[10px]"
                            style={stepDone ? { borderColor: "var(--p-green)", background: "var(--p-green)", color: "#0B0B0C" } : { borderColor: "var(--p-border-strong)", color: "transparent" }}
                          >
                            ✓
                          </span>
                          <span className={stepDone ? "p-body" : "p-secondary"}>{ONBOARDING_STEP_LABELS[k]}</span>
                        </div>
                      );
                    })}
                  </div>
                  {applicant?.recruiting_status && (
                    <div className="mt-4 flex items-center gap-2">
                      <span className="p-label">Recruiting status</span>
                      <Badge tone={recruitingStatusTone(applicant.recruiting_status)}>
                        {recruitingStatusLabel(applicant.recruiting_status)}
                      </Badge>
                    </div>
                  )}
                  {applicant?.id && (
                    <div className="mt-4">
                      <Link to="/portal/applicants" search={{ open: applicant.id }}>
                        <Button variant="secondary" size="sm">Open recruiting record →</Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </Panel>
          </div>
        </div>
      </PageBody>
    </PortalShell>
  );
}

function DField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="p-label mb-1">{label}</div>
      <div className="p-body capitalize">{value}</div>
    </div>
  );
}
