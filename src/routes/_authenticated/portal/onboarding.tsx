import { createFileRoute, Link } from "@tanstack/react-router";
import { formatPhone } from "@/lib/phone";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import {
  PageHeader,
  PageBody,
  Panel,
  Button,
  Badge,
  ErrorState,
  CardSkeleton,
  notify,
} from "@/components/portal/ui";
import {
  getMyOnboarding,
  completeOnboardingStep,
  notifyOnboarding,
  getOnboardingContext,
  type OnboardingContext,
} from "@/lib/portal.functions";
import {
  getOnboardingContent,
  type OnboardingStepRow,
  type ScheduleItemRow,
} from "@/lib/onboarding-content.functions";
import type { OnboardingStepState } from "@/lib/onboarding";

export const Route = createFileRoute("/_authenticated/portal/onboarding")({
  head: () => ({
    meta: [{ title: "Onboarding — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: OnboardingPage,
});

function stepState(
  steps: Record<string, OnboardingStepState> | undefined,
  key: string,
): OnboardingStepState {
  return steps?.[key] ?? { completed: false, completed_at: null };
}

function OnboardingPage() {
  const qc = useQueryClient();
  const fetchOnboarding = useServerFn(getMyOnboarding);
  const completeStep = useServerFn(completeOnboardingStep);
  const notifyFn = useServerFn(notifyOnboarding);
  const fetchContext = useServerFn(getOnboardingContext);
  const fetchContent = useServerFn(getOnboardingContent);

  const q = useQuery({ queryKey: ["my-onboarding"], queryFn: () => fetchOnboarding() });
  const ctxQ = useQuery({ queryKey: ["onboarding-context"], queryFn: () => fetchContext() });
  const contentQ = useQuery({ queryKey: ["onboarding", "content"], queryFn: () => fetchContent() });

  const mut = useMutation({
    mutationFn: (step: string) => completeStep({ data: { step } as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-onboarding"] });
      qc.invalidateQueries({ queryKey: ["applicants"] });
      qc.invalidateQueries({ queryKey: ["applicant"] });
      notify.success("Step marked complete.");
    },
    onError: () => notify.error("Could not update that step.", "Please try again."),
  });

  const notifyContracting = () => {
    notifyFn({ data: { kind: "contracting_done" } }).catch(() => {});
  };

  if (q.isLoading || contentQ.isLoading) {
    return (
      <PortalShell>
        <PageBody>
          <PageHeader title="Your onboarding checklist" description="Welcome to Vantage" />
          <div className="max-w-[820px] space-y-4">
            <CardSkeleton lines={1} />
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
          <PageHeader title="Your onboarding checklist" description="Welcome to Vantage" />
          <div className="max-w-[820px]">
            <Panel>
              <ErrorState
                description="We couldn't load your checklist right now. Please try again."
                onRetry={() => q.refetch()}
              />
            </Panel>
          </div>
        </PageBody>
      </PortalShell>
    );
  }

  const defs = (contentQ.data?.steps ?? []) as OnboardingStepRow[];
  const schedule = (contentQ.data?.schedule ?? []) as ScheduleItemRow[];
  const links = contentQ.data?.links ?? {};
  const courseById = contentQ.data?.courseById ?? {};
  const data = q.data;

  if (!data?.hasOnboarding) {
    return (
      <PortalShell>
        <PageBody>
          <PageHeader title="Onboarding checklist" description="Welcome to Vantage" />
          <div className="max-w-[820px] space-y-4">
            <Panel>
              <p className="p-secondary">
                This is the checklist new Vantage agents complete when they join. Your account doesn't
                have an active onboarding checklist, so these steps are shown here as a preview.
              </p>
            </Panel>
            <Panel padded={false}>
              <StepChecklist
                preview
                defs={defs}
                schedule={schedule}
                links={links}
                courseById={courseById}
                ctx={ctxQ.data}
              />
            </Panel>
          </div>
        </PageBody>
      </PortalShell>
    );
  }

  const steps = data.steps as Record<string, OnboardingStepState>;
  const required = defs.filter((d) => d.is_required);
  const total = required.length || defs.length || 1;
  const done = required.filter((d) => stepState(steps, d.step_key).completed).length;
  const allDone = total > 0 && done >= total;
  const pct = Math.round((done / total) * 100);
  const currentIndex = defs.findIndex((d) => !stepState(steps, d.step_key).completed);

  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Your onboarding checklist" description="Welcome to Vantage" />

        <div className="max-w-[820px] space-y-4">
          <Panel>
            <div className="mb-2 flex items-center justify-between">
              <span className="p-label">
                {allDone ? "All steps complete" : `Step ${Math.min(currentIndex + 1, total)} of ${total}`}
              </span>
              <span className="p-metric" style={{ color: "var(--p-gold)" }}>
                {pct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--p-hover)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(4, pct)}%`, background: "var(--p-gold)" }}
              />
            </div>
          </Panel>

          {allDone && <CompletionPanel />}

          <Panel padded={false}>
            <StepChecklist
              defs={defs}
              schedule={schedule}
              links={links}
              courseById={courseById}
              steps={steps}
              currentIndex={currentIndex}
              pending={mut.isPending}
              ctx={ctxQ.data}
              onComplete={(key, showUpline) => {
                mut.mutate(key);
                if (showUpline) notifyContracting();
              }}
            />
          </Panel>
        </div>
      </PageBody>
    </PortalShell>
  );
}

function CompletionPanel() {
  const notifyFn = useServerFn(notifyOnboarding);
  const [sent, setSent] = useState(false);
  const mut = useMutation({
    mutationFn: () => notifyFn({ data: { kind: "trainer" } }),
    onSuccess: () => {
      setSent(true);
      notify.success("Your trainer has been notified.");
    },
    onError: () => notify.error("Could not notify your trainer.", "Please try again."),
  });
  return (
    <Panel className="text-center">
      <div
        className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full text-[22px]"
        style={{ background: "var(--p-gold)", color: "#0B0B0C" }}
      >
        ✓
      </div>
      <h2 className="p-card-title">Onboarding complete</h2>
      <p className="p-secondary mx-auto mt-2 max-w-[460px]">
        You&apos;re ready for Vantage New Agent Live Training. Notify your trainer that you have completed
        onboarding.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button variant="primary" loading={mut.isPending} disabled={sent} onClick={() => mut.mutate()}>
          {sent ? "✓ Trainer notified" : "Notify trainer"}
        </Button>
        <Link to="/portal">
          <Button variant="secondary">Go to your dashboard →</Button>
        </Link>
      </div>
    </Panel>
  );
}

function PrefillRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="p-muted text-[12px]">{label}</span>
      <span className="text-[13px]" style={{ color: value ? "var(--p-text)" : "var(--p-text-3)" }}>
        {value || "Add during setup"}
      </span>
    </div>
  );
}

function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="mt-3 rounded-[10px] border p-3"
      style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}
    >
      <div className="p-label mb-1">{title}</div>
      {children}
    </div>
  );
}

function defaultButtonLabel(def: OnboardingStepRow) {
  if (def.button_label) return def.button_label;
  switch (def.action_type) {
    case "course":
      return "Open the course";
    case "resource":
      return "Open the file";
    case "presentation":
      return "Watch the recording";
    case "internal":
      return "Open in the portal";
    default:
      return "Open link";
  }
}

/** The onboarding checklist, built from the admin-managed step list. */
function StepChecklist({
  defs,
  schedule,
  links,
  courseById,
  steps,
  currentIndex = 0,
  onComplete,
  pending,
  preview,
  ctx,
}: {
  defs: OnboardingStepRow[];
  schedule: ScheduleItemRow[];
  links: Record<string, string>;
  courseById: Record<string, { slug: string; title: string; status: string }>;
  steps?: Record<string, OnboardingStepState>;
  currentIndex?: number;
  onComplete?: (key: string, showUpline: boolean) => void;
  pending?: boolean;
  preview?: boolean;
  ctx?: OnboardingContext;
}) {
  const allKeys = defs.map((d) => d.step_key);
  const [open, setOpen] = useState<string[]>(() =>
    preview
      ? allKeys
      : defs.length
        ? [defs[Math.min(currentIndex < 0 ? 0 : currentIndex, defs.length - 1)].step_key]
        : [],
  );
  const allOpen = open.length === allKeys.length && allKeys.length > 0;

  if (defs.length === 0) {
    return (
      <div className="px-4 py-6">
        <p className="p-secondary">No onboarding steps have been published yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--p-border)" }}
      >
        <span className="p-label">Onboarding steps ({allKeys.length})</span>
        <Button variant="ghost" size="sm" onClick={() => setOpen(allOpen ? [] : allKeys)}>
          {allOpen ? "Collapse all" : "Expand all"}
        </Button>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--p-border)" }}>
        {defs.map((def, i) => {
          const state = stepState(steps, def.step_key);
          const done = state.completed;
          const isCurrent = !preview && !done && i === currentIndex;
          const status: "done" | "current" | "upcoming" = done ? "done" : isCurrent ? "current" : "upcoming";
          return (
            <StepRow
              key={def.step_key}
              n={i + 1}
              def={def}
              schedule={schedule}
              links={links}
              courseById={courseById}
              ctx={ctx}
              status={preview ? "upcoming" : status}
              state={state}
              pending={pending}
              preview={preview}
              expanded={open.includes(def.step_key)}
              onToggle={() =>
                setOpen((prev) =>
                  prev.includes(def.step_key)
                    ? prev.filter((k) => k !== def.step_key)
                    : [...prev, def.step_key],
                )
              }
              onComplete={() => onComplete?.(def.step_key, def.show_upline)}
            />
          );
        })}
      </div>
    </div>
  );
}

function StepBody({
  def,
  schedule,
  links,
  courseById,
  ctx,
}: {
  def: OnboardingStepRow;
  schedule: ScheduleItemRow[];
  links: Record<string, string>;
  courseById: Record<string, { slug: string; title: string; status: string }>;
  ctx?: OnboardingContext;
}) {
  const course = def.course_id ? courseById[def.course_id] : undefined;
  const href =
    def.action_type === "external"
      ? def.action_url || links[def.step_key] || null
      : null;

  return (
    <>
      {def.description && <p className="p-secondary">{def.description}</p>}
      {def.instructions && (
        <div className="p-secondary mt-2 whitespace-pre-line leading-snug">{def.instructions}</div>
      )}

      {def.show_upline && (
        <>
          <InfoBox title="Your upline">
            {ctx?.upline ? (
              <p className="text-[15px] font-semibold" style={{ color: "var(--p-gold)" }}>
                {ctx.upline.name}
              </p>
            ) : (
              <p className="p-secondary">
                We couldn&apos;t determine your upline automatically. Contact your recruiter before continuing.
              </p>
            )}
          </InfoBox>
          <InfoBox title="Use these details">
            <PrefillRow label="Full name" value={ctx?.prefill.fullName ?? null} />
            <PrefillRow label="Email" value={ctx?.prefill.email ?? null} />
            <PrefillRow label="Phone" value={formatPhone(ctx?.prefill.phone) || null} />
            <PrefillRow label="NPN" value={ctx?.prefill.npn ?? null} />
          </InfoBox>
        </>
      )}

      {def.show_schedule && schedule.length > 0 && (
        <InfoBox title="Weekly schedule">
          <ul className="space-y-1.5">
            {schedule.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-2">
                <span className="text-[13px]" style={{ color: "var(--p-text)" }}>
                  {s.label}
                </span>
                <Badge tone="gold">{s.when_text}</Badge>
                {s.note && <span className="p-muted text-[12px]">{s.note}</span>}
              </li>
            ))}
          </ul>
        </InfoBox>
      )}

      {def.completion_mode === "auto" && (
        <p className="p-muted mt-2">This step completes automatically once the course is finished.</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {href && (
          <a href={href} target="_blank" rel="noreferrer noopener">
            <Button variant="secondary" size="sm">
              {defaultButtonLabel(def)} →
            </Button>
          </a>
        )}
        {def.action_type === "internal" && def.internal_path && (
          <Link to={def.internal_path as any}>
            <Button variant="secondary" size="sm">
              {defaultButtonLabel(def)} →
            </Button>
          </Link>
        )}
        {def.action_type === "course" &&
          (course && course.status !== "draft" ? (
            <Link to="/portal/academy/courses/$slug" params={{ slug: course.slug }}>
              <Button variant="secondary" size="sm">
                {defaultButtonLabel(def)} →
              </Button>
            </Link>
          ) : (
            <p className="p-muted">The course isn&apos;t published yet — contact your recruiter.</p>
          ))}
        {(def.action_type === "resource" || def.action_type === "presentation") && (
          <Link to="/portal/academy">
            <Button variant="secondary" size="sm">
              {defaultButtonLabel(def)} →
            </Button>
          </Link>
        )}
      </div>
    </>
  );
}

function StepRow({
  n,
  def,
  schedule,
  links,
  courseById,
  ctx,
  status,
  state,
  pending,
  preview,
  expanded,
  onToggle,
  onComplete,
}: {
  n: number;
  def: OnboardingStepRow;
  schedule: ScheduleItemRow[];
  links: Record<string, string>;
  courseById: Record<string, { slug: string; title: string; status: string }>;
  ctx?: OnboardingContext;
  status: "done" | "current" | "upcoming";
  state: OnboardingStepState;
  pending?: boolean;
  preview?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onComplete: () => void;
}) {
  const indicator =
    status === "done" ? (
      <div
        className="grid h-8 w-8 flex-none place-items-center rounded-full text-[14px] font-semibold"
        style={{ background: "rgba(63,179,127,0.12)", color: "var(--p-green)" }}
      >
        ✓
      </div>
    ) : status === "current" ? (
      <div
        className="grid h-8 w-8 flex-none place-items-center rounded-full border-2 text-[13px] font-semibold"
        style={{ borderColor: "var(--p-gold)", color: "var(--p-gold)" }}
      >
        {n}
      </div>
    ) : (
      <div
        className="grid h-8 w-8 flex-none place-items-center rounded-full border text-[13px] font-semibold"
        style={{ borderColor: "var(--p-border)", color: "var(--p-text-3)" }}
      >
        {n}
      </div>
    );

  return (
    <div className="px-4 py-4" style={status === "current" ? { background: "var(--p-gold-soft)" } : undefined}>
      <div className="flex items-start gap-3">
        {indicator}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex w-full flex-wrap items-center gap-2 text-left"
          >
            <h3 className="p-card-title" style={status === "upcoming" ? { color: "var(--p-text-3)" } : undefined}>
              {def.title}
            </h3>
            {status === "done" && <Badge tone="green">Done</Badge>}
            {status === "current" && <Badge tone="gold">Current step</Badge>}
            {!def.is_required && <Badge tone="neutral">Optional</Badge>}
            <span
              className="ml-auto text-[12px] transition-transform"
              style={{ color: "var(--p-text-3)", transform: expanded ? "rotate(180deg)" : "none" }}
              aria-hidden
            >
              ▾
            </span>
          </button>

          {!expanded ? (
            <p className="p-secondary mt-1">{def.description}</p>
          ) : (
            <div className="mt-1.5">
              <StepBody def={def} schedule={schedule} links={links} courseById={courseById} ctx={ctx} />
            </div>
          )}

          {!preview && (
            <div className="mt-3">
              {status === "done" ? (
                <div className="text-[12px]" style={{ color: "var(--p-green)" }}>
                  Completed
                  {state.completed_at ? ` · ${new Date(state.completed_at).toLocaleDateString()}` : ""}
                </div>
              ) : status === "current" && def.completion_mode === "self" ? (
                <Button variant="primary" size="sm" onClick={onComplete} disabled={pending}>
                  Mark this step complete
                </Button>
              ) : status === "current" && def.completion_mode === "admin" ? (
                <p className="p-muted text-[12px]">Your leader confirms this step once it&apos;s done.</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
