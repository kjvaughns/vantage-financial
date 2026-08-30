import { createFileRoute, Link } from "@tanstack/react-router";
import { formatPhone } from "@/lib/phone";
import { SCHEDULE } from "@/lib/schedule";
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
  Checkbox,
  notify,
} from "@/components/portal/ui";
import { AGENT_CLOUD_INVITE_URL, DISCORD_INVITE_URL } from "@/lib/next-steps";
import {
  getMyOnboarding,
  completeOnboardingStep,
  notifyOnboarding,
  getOnboardingContext,
  type OnboardingContext,
} from "@/lib/portal.functions";
import {
  ONBOARDING_STEP_ORDER,
  type OnboardingStepKey,
  type OnboardingStepState,
} from "@/lib/onboarding";

export const Route = createFileRoute("/_authenticated/portal/onboarding")({
  head: () => ({
    meta: [{ title: "Onboarding — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: OnboardingPage,
});

const AGENT_CLOUD_INVITE = AGENT_CLOUD_INVITE_URL;
const DISCORD_INVITE = DISCORD_INVITE_URL;

type SelfCheckStep = Exclude<OnboardingStepKey, never>;

function stepState(
  steps: Record<string, OnboardingStepState> | undefined,
  key: OnboardingStepKey,
): OnboardingStepState {
  return steps?.[key] ?? { completed: false, completed_at: null };
}

function OnboardingPage() {
  const qc = useQueryClient();
  const fetchOnboarding = useServerFn(getMyOnboarding);
  const completeStep = useServerFn(completeOnboardingStep);
  const notifyFn = useServerFn(notifyOnboarding);

  const fetchContext = useServerFn(getOnboardingContext);

  const q = useQuery({
    queryKey: ["my-onboarding"],
    queryFn: () => fetchOnboarding(),
  });

  const ctxQ = useQuery({
    queryKey: ["onboarding-context"],
    queryFn: () => fetchContext(),
  });

  const mut = useMutation({
    mutationFn: (step: SelfCheckStep) => completeStep({ data: { step } }),
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

  if (q.isLoading) {
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
              <StepChecklist preview ctx={ctxQ.data} />
            </Panel>
          </div>
        </PageBody>
      </PortalShell>
    );
  }

  const steps = data.steps as Record<string, OnboardingStepState>;
  const done = data.done ?? 0;
  const total = data.total ?? ONBOARDING_STEP_ORDER.length;
  const allDone = !!data.complete;
  const pct = Math.round((done / total) * 100);
  const currentIndex = ONBOARDING_STEP_ORDER.findIndex((k) => !stepState(steps, k).completed);

  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Your onboarding checklist" description="Welcome to Vantage" />

        <div className="max-w-[820px] space-y-4">
          <Panel>
            <div className="mb-2 flex items-center justify-between">
              <span className="p-label">
                {allDone
                  ? "All steps complete"
                  : `Step ${Math.min(currentIndex + 1, total)} of ${total}`}
              </span>
              <span className="p-metric" style={{ color: "var(--p-gold)" }}>{pct}%</span>
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
              steps={steps}
              currentIndex={currentIndex}
              onComplete={(s) => mut.mutate(s)}
              onCompleteAgentCloud={() => {
                mut.mutate("agent_cloud_onboarding");
                notifyContracting();
              }}
              pending={mut.isPending}
              ctx={ctxQ.data}
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
        You&apos;re ready for Vantage New Agent Training. Notify your trainer that you have completed
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

type StepDef = {
  key: SelfCheckStep;
  title: string;
  summary: string;
  actionLabel: string;
  requireAgree?: string;
  render: () => React.ReactNode;
};

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

function AdminWarning({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-3 rounded-[10px] border p-3 text-[12px]"
      style={{ borderColor: "var(--p-gold)", background: "var(--p-gold-soft)", color: "var(--p-text)" }}
    >
      <strong>Configuration warning (admins only):</strong> {children}
    </div>
  );
}

function stepDefs(ctx?: OnboardingContext): StepDef[] {
  return [
    {
      key: "agent_cloud_onboarding",
      title: "Agent Cloud onboarding",
      summary: "Create your Agent Cloud account using the Vantage invite link.",
      actionLabel: "I Created My Agent Cloud Account",
      render: () => (
        <>
          <p className="p-secondary">
            Create your Agent Cloud account using the Vantage invite link below. When Agent Cloud asks
            for your upline, select or enter the leader shown here.
          </p>
          <div
            className="mt-3 rounded-[10px] border p-3"
            style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}
          >
            <div className="p-label mb-1">Your upline</div>
            {ctx?.upline ? (
              <p className="text-[15px] font-semibold" style={{ color: "var(--p-gold)" }}>
                {ctx.upline.name}
              </p>
            ) : (
              <p className="p-secondary">
                We couldn&apos;t determine your upline automatically. Contact your recruiter for your
                upline before continuing.
              </p>
            )}
          </div>
          <div
            className="mt-3 rounded-[10px] border p-3"
            style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}
          >
            <div className="p-label mb-1">Use these details</div>
            <PrefillRow label="Full name" value={ctx?.prefill.fullName ?? null} />
            <PrefillRow label="Email" value={ctx?.prefill.email ?? null} />
            <PrefillRow label="Phone" value={formatPhone(ctx?.prefill.phone) || null} />
            <PrefillRow label="NPN" value={ctx?.prefill.npn ?? null} />
            <p className="p-muted mt-2 text-[12px]">
              You&apos;ll also choose a password for Agent Cloud during setup.
            </p>
          </div>
          <div className="mt-3">
            <a href={AGENT_CLOUD_INVITE} target="_blank" rel="noreferrer noopener">
              <Button variant="secondary" size="sm">Create Agent Cloud Account →</Button>
            </a>
          </div>
        </>
      ),
    },
    {
      key: "discord_role_update",
      title: "Update Discord role",
      summary: "Select the Licensed role in Start Here to unlock the licensed agent channels.",
      actionLabel: "I've Updated My Discord Role",
      render: () => (
        <>
          <ol className="p-secondary ml-4 list-decimal space-y-1">
            <li>Join the Vantage Financial Discord if you haven&apos;t already.</li>
            <li>
              Go to the <strong style={{ color: "var(--p-text)" }}>Start Here</strong> area.
            </li>
            <li>
              Select <strong style={{ color: "var(--p-text)" }}>Licensed</strong>.
            </li>
          </ol>
          <p className="p-muted mt-2">
            Once you select Licensed, the full licensed agent Discord unlocks.
          </p>
          <div className="mt-3">
            <a href={DISCORD_INVITE} target="_blank" rel="noreferrer noopener">
              <Button variant="secondary" size="sm">Open Discord →</Button>
            </a>
          </div>
        </>
      ),
    },
    {
      key: "read_agent_playbook",
      title: "Read the Vantage Financial Agent Playbook",
      summary: "Covers how we sell, our systems, and what's expected of every agent.",
      actionLabel: "I Have Read the Playbook",
      render: () => (
        <>
          <p className="p-secondary">
            Read the Agent Playbook end to end — it covers how we sell, our systems, and what&apos;s
            expected of every Vantage agent.
          </p>
          {ctx?.playbook ? (
            <div className="mt-3">
              <Link to="/portal/academy/library/$slug" params={{ slug: ctx.playbook.slug }}>
                <Button variant="secondary" size="sm">Open Agent Playbook →</Button>
              </Link>
            </div>
          ) : (
            <>
              <p className="p-muted mt-2">
                The Agent Playbook isn&apos;t available yet — contact your recruiter.
              </p>
              {ctx?.isAdmin && (
                <AdminWarning>
                  No published Academy library resource with &quot;Playbook&quot; in the title was
                  found. Publish the Agent Playbook in Academy → Manage → Library.
                </AdminWarning>
              )}
            </>
          )}
        </>
      ),
    },
    {
      key: "agent_expectations_schedule",
      title: "Agent expectations & schedule",
      summary: "Weekly meeting schedule and the Vantage production standards.",
      actionLabel: "I understand and agree",
      requireAgree: "I understand and agree to the Vantage Financial standards and schedule.",
      render: () => (
        <>
          <div className="p-label mb-1">Weekly schedule (CST)</div>
          <ul className="p-secondary space-y-1">
            {SCHEDULE.map((s) => (
              <li key={s.label}>
                <strong style={{ color: "var(--p-text)" }}>{s.label}</strong> — {s.when}
                {s.note ? ` (${s.note})` : ""}
              </li>
            ))}
          </ul>
          <p className="p-muted mt-2">Encouraged to start earlier and continue calling later when possible.</p>

          <div className="p-label mt-4 mb-1">Standards &amp; expectations</div>
          <ul className="p-secondary ml-4 list-disc space-y-1">
            <li>Cameras must be on while calling.</li>
            <li>Stay unmuted while calling unless operationally necessary.</li>
            <li>Do not be late to meetings.</li>
            <li>$5,000 weekly and $20,000 monthly personal production is the Vantage standard.</li>
            <li>Closing business consistently is a normal expectation of the sales role.</li>
            <li>Agents below standard may be assigned additional training.</li>
            <li>Consistently falling below production standards may result in loss of free lead eligibility and possible termination.</li>
            <li>New Agent Training begins Mondays; the Monday Team Meeting is mandatory.</li>
            <li>Missing required meetings without prior communication may result in termination — communicate beforehand, not after.</li>
          </ul>
        </>
      ),
    },
    {
      key: "complete_vantage_closer_course",
      title: "Complete the Vantage Closer Course",
      summary: "Required pre-training course on the Vantage sales process and mindset.",
      actionLabel: "I've completed the course",
      render: () => (
        <>
          <p className="p-secondary">
            The Vantage Closer Course is the required pre-training course covering the Vantage sales
            process, sales psychology, mindset, and fundamentals you&apos;ll need before live training.
          </p>
          <p className="p-muted mt-2">This step completes automatically once you finish the course.</p>
          {ctx?.closerCourse?.published ? (
            <div className="mt-3">
              <Link to="/portal/academy/courses/$slug" params={{ slug: ctx.closerCourse.slug }}>
                <Button variant="secondary" size="sm">Start Vantage Closer Course →</Button>
              </Link>
            </div>
          ) : (
            <>
              <p className="p-muted mt-2">
                The course isn&apos;t available yet — contact your recruiter.
              </p>
              {ctx?.isAdmin && (
                <AdminWarning>
                  {ctx?.closerCourse
                    ? "The Vantage Closer Course exists but isn't published. Publish it in Academy → Manage → Courses."
                    : "No Academy course with \"Closer\" in the title was found. Create and publish the Vantage Closer Course in Academy → Manage → Courses."}
                </AdminWarning>
              )}
            </>
          )}
        </>
      ),
    },
  ];
}

/** The single sequential onboarding checklist. Shared by the live agent view and the read-only preview. */
function StepChecklist({
  steps,
  currentIndex = 0,
  onComplete,
  onCompleteAgentCloud,
  pending,
  preview,
  ctx,
}: {
  steps?: Record<string, OnboardingStepState>;
  currentIndex?: number;
  onComplete?: (step: SelfCheckStep) => void;
  onCompleteAgentCloud?: () => void;
  pending?: boolean;
  preview?: boolean;
  ctx?: OnboardingContext;
}) {
  const STEP_DEFS = stepDefs(ctx);
  const allKeys = STEP_DEFS.map((d) => d.key);
  const [open, setOpen] = useState<string[]>(() =>
    preview ? allKeys : [STEP_DEFS[Math.min(currentIndex < 0 ? 0 : currentIndex, STEP_DEFS.length - 1)].key],
  );
  const allOpen = open.length === allKeys.length;

  return (
    <div>
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--p-border)" }}
      >
        <span className="p-label">Onboarding steps ({allKeys.length})</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(allOpen ? [] : allKeys)}
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </Button>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--p-border)" }}>
        {STEP_DEFS.map((def, i) => {
          const state = stepState(steps, def.key);
          const done = state.completed;
          const isCurrent = !preview && !done && i === currentIndex;
          const status: "done" | "current" | "upcoming" = done ? "done" : isCurrent ? "current" : "upcoming";
          return (
            <StepRow
              key={def.key}
              n={i + 1}
              def={def}
              status={preview ? "upcoming" : status}
              state={state}
              pending={pending}
              preview={preview}
              expanded={open.includes(def.key)}
              onToggle={() =>
                setOpen((prev) =>
                  prev.includes(def.key) ? prev.filter((k) => k !== def.key) : [...prev, def.key],
                )
              }
              onComplete={() =>
                def.key === "agent_cloud_onboarding" && onCompleteAgentCloud
                  ? onCompleteAgentCloud()
                  : onComplete?.(def.key)
              }
            />
          );
        })}
      </div>
    </div>
  );
}


function StepRow({
  n,
  def,
  status,
  state,
  pending,
  preview,
  expanded,
  onToggle,
  onComplete,
}: {
  n: number;
  def: StepDef;
  status: "done" | "current" | "upcoming";
  state: OnboardingStepState;
  pending?: boolean;
  preview?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onComplete: () => void;
}) {
  const [agreed, setAgreed] = useState(false);


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
    <div
      className="px-4 py-4"
      style={status === "current" ? { background: "var(--p-gold-soft)" } : undefined}
    >
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
            <span
              className="ml-auto text-[12px] transition-transform"
              style={{
                color: "var(--p-text-3)",
                transform: expanded ? "rotate(180deg)" : "none",
              }}
              aria-hidden
            >
              ▾
            </span>
          </button>

          {!expanded ? (
            <p className="p-secondary mt-1">{def.summary}</p>
          ) : (
            <div className="mt-1.5">{def.render()}</div>
          )}


          {status === "current" && def.requireAgree && (
            <div className="mt-3">
              <Checkbox checked={agreed} onChange={setAgreed} label={def.requireAgree} />
            </div>
          )}

          {!preview && (
            <div className="mt-3">
              {status === "done" ? (
                <div className="text-[12px]" style={{ color: "var(--p-green)" }}>
                  Completed
                  {state.completed_at ? ` · ${new Date(state.completed_at).toLocaleDateString()}` : ""}
                </div>
              ) : status === "current" ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onComplete}
                  disabled={pending || (!!def.requireAgree && !agreed)}
                >
                  {def.actionLabel}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
