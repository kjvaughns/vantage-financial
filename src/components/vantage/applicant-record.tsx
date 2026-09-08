import { Link } from "@tanstack/react-router";
import { formatPhone, phoneHref } from "@/lib/phone";
import { instagramLabel, instagramUrl } from "@/lib/instagram";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronLeft, Mail, X, MessageSquare, Phone, ClipboardList } from "lucide-react";
import {
  getApplicant,
  updateApplicant,
  updateApplicantStage,
  addApplicantNote,
  logApplicantActivity,
  setOverviewStatus,
  sendFollowUpEmail,
  setDiscordConfirmed,
  listAssignableUsers,
  sendApplicantEmail,
  setApplicantExam,
  markExamResult,
  startApplicantFollowUp,
} from "@/lib/portal.functions";
import { fillTemplate } from "@/lib/emails/catalog";
import { composerTemplates } from "@/lib/email/catalog";
import { listEmailHistory } from "@/lib/email.functions";
import { sendApplicantEmail as sendBrandedApplicantEmail } from "@/lib/email.functions";
import { getInvitableContext, promoteApplicantToAgent } from "@/lib/invitations.functions";
import {
  getOnboardingContent,
  setAgentOnboardingStep,
  type OnboardingStepRow,
} from "@/lib/onboarding-content.functions";
import {
  ONBOARDING_STEP_ORDER,
  ONBOARDING_STEP_LABELS,
} from "@/lib/onboarding";
import {
  RECRUITING_STATUSES,
  RECRUITING_STATUS_LABELS,
  recruitingStatusLabel,
  recruitingStatusTone,
} from "@/lib/recruiting";
import {
  Panel,
  Button,
  Badge,
  Textarea,
  Select,
  Input,
  Field,
  Modal,
  Tabs,
  Checkbox,
  Skeleton,
  CardSkeleton,
  ErrorState,
  EmptyState,
  notify,
  SegmentedControl,
  ListSkeleton,
} from "@/components/portal/ui";

/* -------------------------------------------------------------------------- */
/* Manual activity types                                                      */
/* -------------------------------------------------------------------------- */

const ACTIVITY_TYPES: { value: string; label: string }[] = [
  { value: "called", label: "Called" },
  { value: "no_answer", label: "No Answer" },
  { value: "left_voicemail", label: "Left Voicemail" },
  { value: "text_sent", label: "Text Sent" },
  { value: "email_sent", label: "Email Sent" },
  { value: "spoke_with", label: "Spoke With Applicant" },
  { value: "interview_scheduled", label: "Interview Scheduled" },
  { value: "interview_completed", label: "Interview Completed" },
  { value: "follow_up_scheduled", label: "Follow Up Scheduled" },
  { value: "evaluation_completed", label: "Evaluation Completed" },
  { value: "licensing_update", label: "Licensing Update" },
  { value: "onboarding_started", label: "Onboarding Started" },
  { value: "training_started", label: "Training Started" },
  { value: "hired", label: "Hired" },
  { value: "terminated", label: "Terminated" },
  { value: "other", label: "Other" },
];

const EVENT_LABELS: Record<string, string> = {
  application_submitted: "Application submitted",
  evaluation_submitted: "Evaluation submitted",
  appointment_scheduled: "Appointment scheduled",
  overview_updated: "Overview updated",
  follow_up_sent: "Follow-up sent",
  discord_updated: "Discord confirmation",
  stage_changed: "Stage changed",
  record_updated: "Record updated",
  note: "Note",
  manual_applicant_created: "Applicant created",
  promoted_to_agent: "Promoted to agent",
  ...Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.value, t.label])),
};
function eventLabel(t: string) {
  return EVENT_LABELS[t] ?? t.replace(/_/g, " ");
}

/* -------------------------------------------------------------------------- */
/* Datetime helpers (ISO <-> <input type=datetime-local>)                     */
/* -------------------------------------------------------------------------- */

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* -------------------------------------------------------------------------- */
/* ApplicantRecord — shared by the drawer and the full page                   */
/* -------------------------------------------------------------------------- */

export function ApplicantRecord({
  applicantId,
  variant = "page",
  onClose,
}: {
  applicantId: string;
  variant?: "page" | "drawer";
  onClose?: () => void;
}) {
  const qc = useQueryClient();
  const fetchOne = useServerFn(getApplicant);
  const saveFn = useServerFn(updateApplicant);
  const changeStage = useServerFn(updateApplicantStage);
  const addNote = useServerFn(addApplicantNote);
  const setOverview = useServerFn(setOverviewStatus);
  const usersFn = useServerFn(listAssignableUsers);

  const recordQ = useQuery({
    queryKey: ["applicant", applicantId],
    queryFn: () => fetchOne({ data: { id: applicantId } }),
  });
  const { data, isLoading } = recordQ;
  const usersQ = useQuery({ queryKey: ["assignable-users"], queryFn: () => usersFn() });

  const a = data?.applicant as any;
  const currentStage = data?.stages.find((s) => s.id === a?.current_stage_id);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
    qc.invalidateQueries({ queryKey: ["applicants"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  async function save(patch: Record<string, unknown>) {
    try {
      await saveFn({ data: { id: applicantId, ...(patch as any) } });
      invalidate();
    } catch (e) {
      notify.error("Couldn't save that change", "Please check the value and try again.");
    }
  }

  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  async function onStage(stageId: string) {
    try {
      await changeStage({ data: { id: applicantId, stage_id: stageId } });
      invalidate();
    } catch (e) {
      notify.error("Couldn't move them to that stage", "Please try again in a moment.");
    }
  }
  async function onOverview(field: "scheduled" | "completed", value: boolean) {
    await setOverview({ data: { id: applicantId, field, value } });
    invalidate();
  }
  async function onAddNote() {
    if (!note.trim()) return;
    setSavingNote(true);
    try {
      await addNote({ data: { id: applicantId, note: note.trim() } });
      setNote("");
      invalidate();
    } finally {
      setSavingNote(false);
    }
  }

  const Wrapper = variant === "drawer" ? DrawerShell : PageShell;
  const [tab, setTab] = useState<"overview" | "activity" | "emails" | "evaluation">("overview");

  if (recordQ.isError) {
    return (
      <Wrapper onClose={onClose} title="Applicant">
        <ErrorState
          title="Couldn't load this applicant"
          description="Their record didn't load. Check your connection and try again."
          onRetry={() => recordQ.refetch()}
        />
      </Wrapper>
    );
  }

  if (isLoading || !a) {
    return (
      <Wrapper onClose={onClose} title="Loading applicant">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
          <CardSkeleton lines={5} />
          <CardSkeleton lines={3} />
        </div>
      </Wrapper>
    );
  }

  const fullName = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || "Applicant";
  const followUp = a.next_follow_up_at ? new Date(a.next_follow_up_at) : null;

  return (
    <Wrapper
      onClose={onClose}
      title={fullName}
      headerRight={
        <>
          {a.portal_profile_id ? (
            <Badge tone="green">Portal active</Badge>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setPromoteOpen(true)}>
              {a.promoted_to_agent_at ? "Invitation pending" : "Promote to Agent"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Stage + status header */}
        <div className="flex flex-wrap items-center gap-2">
          {currentStage && (
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold"
              style={{
                background: `color-mix(in oklab, ${currentStage.color || "var(--p-gold)"} 14%, transparent)`,
                color: currentStage.color || "var(--p-gold)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: currentStage.color || "var(--p-gold)" }}
                aria-hidden
              />
              {currentStage.name}
            </span>
          )}
          <Badge tone={recruitingStatusTone(a.recruiting_status)}>
            {recruitingStatusLabel(a.recruiting_status)}
          </Badge>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-1.5">
          <QuickAction href={phoneHref(a.phone) ? `tel:${phoneHref(a.phone)}` : undefined} label="Call" icon={<Phone size={14} aria-hidden />} />
          <QuickAction href={phoneHref(a.phone) ? `sms:${phoneHref(a.phone)}` : undefined} label="Text" icon={<MessageSquare size={14} aria-hidden />} />
          <Button variant="secondary" size="sm" onClick={() => setEmailOpen(true)} disabled={!a.email}>
            <Mail size={14} aria-hidden /> Email
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setLogOpen(true)}>
            <ClipboardList size={14} aria-hidden /> Log activity
          </Button>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "activity", label: "Activity", count: (data?.activities ?? []).length },
            { value: "emails", label: "Emails" },
            { value: "evaluation", label: "Evaluation", count: (data?.evaluations ?? []).length },
          ]}
        />

        {tab === "overview" && (
        <div className="space-y-4">
        {/* Editable contact + licensing */}
        <Panel title="Contact & licensing">
          <div key={a.updated_at} className="grid gap-3 sm:grid-cols-2">
            <EditText label="First name" defaultValue={a.first_name ?? ""} onSave={(v) => save({ first_name: v })} />
            <EditText label="Last name" defaultValue={a.last_name ?? ""} onSave={(v) => save({ last_name: v })} />
            <EditText label="Email" type="email" defaultValue={a.email ?? ""} onSave={(v) => save({ email: v })} />
            <EditText label="Phone" defaultValue={formatPhone(a.phone)} onSave={(v) => save({ phone: v ? formatPhone(v) : null })} />
            <EditText label="City" defaultValue={a.city ?? ""} onSave={(v) => save({ city: v || null })} />
            <EditText label="Resident state" defaultValue={a.resident_state ?? a.state ?? ""} onSave={(v) => save({ resident_state: v || null })} />
            <EditText label="NPN" defaultValue={a.npn ?? ""} onSave={(v) => save({ npn: v || null })} />
            <EditText label="Licensing status" defaultValue={a.licensing_status ?? ""} onSave={(v) => save({ licensing_status: v || null })} />
            <div>
              <div className="p-label mb-1">Instagram</div>
              {a.instagram_handle ? (
                <a
                  href={instagramUrl(a.instagram_handle)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="p-body text-[var(--p-gold)] hover:underline"
                >
                  {instagramLabel(a.instagram_handle)}
                </a>
              ) : (
                <span className="p-body text-[var(--p-muted)]">—</span>
              )}
            </div>
            <EditSelectField label="Status" value={a.recruiting_status ?? "pending"} onChange={(v) => save({ recruiting_status: v })}>
              {RECRUITING_STATUSES.map((s) => (
                <option key={s} value={s}>{RECRUITING_STATUS_LABELS[s]}</option>
              ))}
            </EditSelectField>
            <EditSelectField label="Stage" value={a.current_stage_id ?? ""} onChange={(v) => onStage(v)}>
              {(data?.stages ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </EditSelectField>
            <EditSelectField
              label="Assigned recruiter"
              value={a.assigned_recruiter_id ?? ""}
              onChange={(v) => save({ assigned_recruiter_id: v || null })}
            >
              <option value="">— none —</option>
              {(usersQ.data?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </EditSelectField>
            <EditSelectField
              label="Referring recruiter (signed up under)"
              value={a.referred_by_profile_id ?? ""}
              onChange={(v) => save({ referred_by_profile_id: v || null })}
            >
              <option value="">— none —</option>
              {(usersQ.data?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </EditSelectField>
            <EditDateTimeField
              label="Next follow-up"
              defaultValue={isoToLocalInput(a.next_follow_up_at)}
              onSave={(v) => save({ next_follow_up_at: localInputToIso(v) })}
            />
          </div>
          {a.why_text && (
            <div className="mt-4">
              <div className="p-label mb-1">Why Vantage</div>
              <p className="p-body leading-relaxed whitespace-pre-wrap">{a.why_text}</p>
            </div>
          )}
        </Panel>

        {/* Upcoming follow-up */}
        {followUp && (
          <Panel title="Upcoming follow-up">
            <div className="flex items-center gap-2">
              <Badge tone={followUp.getTime() < Date.now() ? "red" : "amber"}>
                {followUp.getTime() < Date.now() ? "Overdue" : "Scheduled"}
              </Badge>
              <span className="p-body">{followUp.toLocaleString()}</span>
            </div>
          </Panel>
        )}

        {/* State exam */}
        <StateExamCard applicant={a} onDone={invalidate} />

        {/* Onboarding progress */}
        {currentStage?.slug === "onboarding" && (
          <OnboardingProgressCard steps={a.onboarding_steps} applicantId={a.id} />
        )}

        {/* Overview meeting */}
        <Panel
          title="Overview meeting"
          description="Booking through Calendly updates this automatically; use these toggles for a manual booking."
        >
          <div className="flex flex-wrap gap-2">
            <OverviewToggle label="Scheduled" active={!!a.overview_scheduled_at} onToggle={(v) => onOverview("scheduled", v)} />
            <OverviewToggle label="Completed" active={!!a.overview_completed_at} onToggle={(v) => onOverview("completed", v)} />
          </div>
        </Panel>

        {!a.licensed && a.hired_at && (
          <DiscordCard applicantId={applicantId} confirmed={!!a.discord_confirmed} onChange={invalidate} />
        )}

        <FollowUpCard applicantId={applicantId} onSent={invalidate} />

        {/* Add note */}
        <Panel title="Add a note">
          <Textarea
            rows={3}
            placeholder="What happened on the last touchpoint?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            variant="primary"
            className="mt-3 w-full"
            onClick={onAddNote}
            loading={savingNote}
            disabled={!note.trim()}
          >
            Add note
          </Button>
        </Panel>
        </div>
        )}

        {/* Evaluation results (View Evaluation) */}
        {tab === "emails" && <ApplicantEmailHistory applicantId={applicantId} />}

        {tab === "evaluation" && (
        <div className="space-y-4">
        {(data?.evaluations ?? []).length === 0 && (
          <Panel>
            <EmptyState
              title="No evaluation yet"
              description="Once they complete the Vantage evaluation, their answers and guidance score appear here."
            />
          </Panel>
        )}
        {(data?.evaluations ?? []).length > 0 &&
          data!.evaluations.map((ev: any) => (
            <Panel
              key={ev.id}
              title="Evaluation"
              description={`Submitted ${new Date(ev.created_at).toLocaleDateString()}`}
              actions={
                typeof ev.score === "number" ? (
                  <Badge tone={ev.score >= 70 ? "green" : ev.score >= 45 ? "amber" : "red"}>
                    Score {ev.score}/100
                  </Badge>
                ) : undefined
              }
            >
              <div className="grid gap-2 text-[13px] sm:grid-cols-2">
                {Object.entries((ev.answers as Record<string, any>) ?? {})
                  .filter(([k, v]) => !k.startsWith("_") && String(v ?? "").trim() !== "")
                  .map(([k, v]) => (
                    <div key={k} className="rounded-[10px] border p-2.5" style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}>
                      <div className="p-label mb-1">{evalFieldLabel(k)}</div>
                      <div className="p-body whitespace-pre-wrap">{String(v)}</div>
                    </div>
                  ))}
              </div>
              <p className="p-muted mt-3 text-[11.5px]">Internal score is guidance only — it never approves or rejects anyone.</p>
            </Panel>
          ))}
        </div>
        )}

        {/* Activity timeline */}
        {tab === "activity" && (
        <Panel
          title="Activity timeline"
          actions={<Button variant="secondary" size="sm" onClick={() => setLogOpen(true)}>Log activity</Button>}
          bodyClassName={(data?.activities ?? []).length === 0 ? undefined : "p-0"}
        >
          {(data?.activities ?? []).length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Calls, texts, emails, stage changes and notes all land here so the whole history stays in one place."
              action={
                <Button size="sm" variant="secondary" onClick={() => setLogOpen(true)}>
                  Log activity
                </Button>
              }
            />
          ) : (
            <div>
              {(data?.activities ?? []).map((act: any) => (
                <div
                  key={act.id}
                  className="flex gap-3 border-b px-4 py-3 last:border-b-0"
                  style={{ borderColor: "var(--p-border)" }}
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: "var(--p-gold)" }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="p-body font-medium">{eventLabel(act.event_type)}</div>
                    {act.summary && <div className="p-secondary mt-0.5">{act.summary}</div>}
                    {act.data?.notes && (
                      <div className="p-secondary mt-0.5 whitespace-pre-wrap">{act.data.notes}</div>
                    )}
                    <div className="p-muted mt-1 text-[11.5px]">
                      {new Date(act.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        )}
      </div>

      {promoteOpen && (
        <PromoteModal applicant={a} onClose={() => setPromoteOpen(false)} onDone={invalidate} />
      )}
      {logOpen && (
        <LogActivityModal
          applicantId={applicantId}
          onClose={() => setLogOpen(false)}
          onLogged={() => {
            setLogOpen(false);
            invalidate();
          }}
        />
      )}
      {emailOpen && (
        <EmailComposerModal
          applicant={a}
          onClose={() => setEmailOpen(false)}
          onSent={() => {
            setEmailOpen(false);
            invalidate();
          }}
        />
      )}
    </Wrapper>
  );
}

/* -------------------------------------------------------------------------- */
/* Shells                                                                     */
/* -------------------------------------------------------------------------- */

function DrawerShell({
  children,
  title,
  headerRight,
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  headerRight?: React.ReactNode;
  onClose?: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-stretch sm:justify-end">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="p-panel relative z-10 flex max-h-[92dvh] w-full flex-col rounded-b-none sm:h-full sm:max-h-none sm:max-w-[560px] sm:rounded-none sm:border-y-0 sm:border-r-0"
      >
        <header
          className="flex items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--p-border)" }}
        >
          <h2 className="p-section-title min-w-0 truncate">{title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {headerRight}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-focus grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-[var(--p-hover)]"
              style={{ color: "var(--p-text-2)" }}
            >
              <X size={15} aria-hidden />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function PageShell({
  children,
  title,
  headerRight,
}: {
  children: React.ReactNode;
  title: string;
  headerRight?: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="mx-auto max-w-[820px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/portal/applicants">
            <Button variant="ghost" size="sm">
              <ChevronLeft size={15} aria-hidden /> Back
            </Button>
          </Link>
          <h1 className="p-title">{title}</h1>
        </div>
        <div className="flex items-center gap-2">{headerRight}</div>
      </div>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inline-edit fields                                                         */
/* -------------------------------------------------------------------------- */

function EditText({
  label,
  defaultValue,
  type = "text",
  onSave,
}: {
  label: string;
  defaultValue: string;
  type?: string;
  onSave: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type={type}
        defaultValue={defaultValue}
        onBlur={(e) => {
          const v = e.currentTarget.value.trim();
          if (v !== (defaultValue ?? "").trim()) onSave(v);
        }}
      />
    </Field>
  );
}

function EditSelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </Select>
    </Field>
  );
}

function EditDateTimeField({
  label,
  defaultValue,
  onSave,
}: {
  label: string;
  defaultValue: string;
  onSave: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="datetime-local"
        defaultValue={defaultValue}
        onBlur={(e) => {
          if (e.currentTarget.value !== defaultValue) onSave(e.currentTarget.value);
        }}
      />
    </Field>
  );
}

function QuickAction({ href, label, icon }: { href?: string; label: string; icon?: React.ReactNode }) {
  if (!href) {
    return (
      <Button variant="secondary" size="sm" disabled title={`No phone number on file`}>
        {icon}
        {label}
      </Button>
    );
  }
  return (
    <a href={href} className="p-focus rounded-[10px]">
      <Button variant="secondary" size="sm" tabIndex={-1}>
        {icon}
        {label}
      </Button>
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* Log Activity modal                                                         */
/* -------------------------------------------------------------------------- */

function LogActivityModal({
  applicantId,
  onClose,
  onLogged,
}: {
  applicantId: string;
  onClose: () => void;
  onLogged: () => void;
}) {
  const logFn = useServerFn(logApplicantActivity);
  const [type, setType] = useState("called");
  const [occurredAt, setOccurredAt] = useState(isoToLocalInput(new Date().toISOString()));
  const [notes, setNotes] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");

  const isFollowUp = type === "follow_up_scheduled";

  const mut = useMutation({
    mutationFn: () =>
      logFn({
        data: {
          id: applicantId,
          type: type as any,
          notes: notes.trim() || undefined,
          occurred_at: localInputToIso(occurredAt) ?? undefined,
          follow_up_at: followUpAt ? localInputToIso(followUpAt) ?? undefined : undefined,
        },
      }),
    onSuccess: () => {
      notify.success("Activity logged");
      onLogged();
    },
    onError: () => notify.error("Couldn't log that activity", "Please try again in a moment."),
  });

  const canSubmit = !mut.isPending && (!isFollowUp || (!!followUpAt && !!notes.trim()));

  return (
    <Modal
      title="Log activity"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => mut.mutate()} loading={mut.isPending} disabled={!canSubmit}>
            Log activity
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Date & time">
          <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
        </Field>
        {isFollowUp && (
          <Field label="Follow-up date & time" required>
            <Input type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
          </Field>
        )}
        <Field label="Notes" required={isFollowUp}>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Details…" />
        </Field>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Send Email composer                                                        */
/* -------------------------------------------------------------------------- */

function EmailComposerModal({
  applicant,
  onClose,
  onSent,
}: {
  applicant: any;
  onClose: () => void;
  onSent: () => void;
}) {
  const sendFn = useServerFn(sendBrandedApplicantEmail);
  const catalog = composerTemplates().map((t) => ({
    name: t.name,
    label: t.label,
    subject: t.subject,
    preview: [t.body.intro ?? "", ...(t.body.lines ?? [])].filter(Boolean).join("\n\n"),
  }));
  const values: Record<string, string> = {
    first_name: applicant.first_name ?? "",
    last_name: applicant.last_name ?? "",
    full_name: `${applicant.first_name ?? ""} ${applicant.last_name ?? ""}`.trim(),
  };

  const [mode, setMode] = useState<"template" | "custom">("template");
  const [templateName, setTemplateName] = useState(catalog[0]?.name ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const active = catalog.find((t) => t.name === templateName);

  const mut = useMutation({
    mutationFn: () =>
      sendFn({
        data:
          mode === "template"
            ? { applicantId: applicant.id, template: templateName }
            : { applicantId: applicant.id, subject: subject.trim(), message: body.trim() },
      }),
    onSuccess: (res: any) => {
      if (res?.status === "skipped") {
        notify.error("Email not delivered", "This address is unsubscribed or bounced previously.");
      } else {
        notify.success("Email sent");
      }
      onSent();
    },
    onError: () => notify.error("Couldn't send that email", "Please try again in a moment."),
  });

  const ready = mode === "template" ? !!templateName : !!subject.trim() && !!body.trim();

  return (
    <Modal
      title="Send email"
      description={applicant.email}
      width={640}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => mut.mutate()}
            loading={mut.isPending}
            disabled={!ready}
          >
            Send email
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: "template", label: "Branded template" },
            { value: "custom", label: "Write your own" },
          ]}
        />
        {mode === "template" ? (
          <>
            <Field label="Template" hint="Sent in the Vantage template, personalized automatically.">
              <Select value={templateName} onChange={(e) => setTemplateName(e.target.value)}>
                {catalog.map((t) => (
                  <option key={t.name} value={t.name}>{t.label}</option>
                ))}
              </Select>
            </Field>
            {active ? (
              <div
                className="rounded-[10px] border p-3"
                style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}
              >
                <div className="p-label mb-1.5">Preview</div>
                <div className="p-secondary mb-1 font-semibold">
                  {fillTemplate(active.subject, values)}
                </div>
                <div className="p-body whitespace-pre-wrap">
                  {fillTemplate(active.preview, values)}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <Field label="Subject">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
            </Field>
            <Field label="Message" hint="Sent inside the Vantage branded layout.">
              <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
            </Field>
            {body.trim() && (
              <div className="rounded-[10px] border p-3" style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}>
                <div className="p-label mb-1.5">Preview</div>
                <div className="p-secondary mb-1 font-semibold">{subject || "(no subject)"}</div>
                <div className="p-body whitespace-pre-wrap">{body}</div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Ported sub-components (promote / overview / discord / follow-up / eval)     */
/* -------------------------------------------------------------------------- */

function PromoteModal({ applicant, onClose, onDone }: { applicant: any; onClose: () => void; onDone: () => void }) {
  const ctxFn = useServerFn(getInvitableContext);
  const promoteFn = useServerFn(promoteApplicantToAgent);
  const ctxQ = useQuery({ queryKey: ["invite", "context"], queryFn: () => ctxFn() });

  const [role, setRole] = useState<"agent" | "leader">("agent");
  const [parent, setParent] = useState("");
  const [team, setTeam] = useState("");
  const [email, setEmail] = useState(applicant.email ?? "");
  const [phone, setPhone] = useState(applicant.phone ?? "");
  const [licensed, setLicensed] = useState(!!applicant.licensed);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      promoteFn({
        data: {
          applicant_id: applicant.id,
          role,
          parent_user_id: parent || "",
          team_id: team || "",
          email: email.trim(),
          phone: phone.trim(),
          state: applicant.resident_state ?? applicant.state ?? "",
          licensed,
        },
      }),
    onSuccess: (res: { token: string }) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setLink(`${origin}/portal-invite/${res.token}`);
      setError("");
      onDone();
    },
    onError: (e: unknown) => setError((e as Error).message || "Could not promote applicant."),
  });

  const parents = ctxQ.data?.parents ?? [];
  const teams = ctxQ.data?.teams ?? [];
  const canPromote = (ctxQ.data?.allowedRoles ?? []).includes("agent");

  return (
    <Modal
      title="Promote to Agent"
      description="Creates a secure portal invitation and moves them to Active. The account is created when they accept."
      onClose={onClose}
    >
      {!canPromote ? (
        <div className="p-body">Your account isn't permitted to invite agents.</div>
      ) : link ? (
        <div>
          <div className="p-secondary mb-2">Invitation created. Share this link:</div>
          <div className="flex gap-2">
            <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* noop */
                }
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <Button variant="ghost" className="mt-4 w-full" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="grid gap-4">
          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="agent">Agent</option>
              {(ctxQ.data?.allowedRoles ?? []).includes("leader") && <option value="leader">Leader</option>}
            </Select>
          </Field>
          <Field label="Reports to">
            <Select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">— none —</option>
              {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Team">
            <Select value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">— none —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Checkbox checked={licensed} onChange={setLicensed} label="Currently licensed" />
          {error && (
            <div className="rounded-[10px] border p-3 text-[13px]" style={{ borderColor: "var(--p-red)", background: "rgba(220,106,98,0.1)", color: "var(--p-red)" }}>
              {error}
            </div>
          )}
          <div className="mt-1 flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => mut.mutate()}
              loading={mut.isPending}
              disabled={!email.trim()}
            >
              Confirm & create invitation
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function DiscordCard({ applicantId, confirmed, onChange }: { applicantId: string; confirmed: boolean; onChange: () => void }) {
  const setFlag = useServerFn(setDiscordConfirmed);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      await setFlag({ data: { id: applicantId, value: !confirmed } });
      onChange();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Discord confirmation" description={`Confirm once you've seen their course-post screenshot in #unlicensed.`}>
      <Button variant={confirmed ? "secondary" : "outline"} onClick={toggle} loading={busy}>
        {confirmed && <Check size={14} aria-hidden />}
        {confirmed ? "Course post confirmed" : "Mark course post confirmed"}
      </Button>
    </Panel>
  );
}

function FollowUpCard({ applicantId, onSent }: { applicantId: string; onSent: () => void }) {
  const send = useServerFn(sendFollowUpEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function onSend() {
    setSending(true);
    setError("");
    try {
      await send({ data: { id: applicantId } });
      setSent(true);
      setTimeout(() => setSent(false), 2500);
      onSent();
    } catch (e) {
      setError((e as Error).message || "Could not send follow-up.");
    } finally {
      setSending(false);
    }
  }
  return (
    <Panel title="Pre-licensing follow-up" description="Sends the weekly check-in template and logs it on the timeline.">
      <Button variant="outline" onClick={onSend} loading={sending}>
        {sent && <Check size={14} aria-hidden />}
        {sent ? "Follow-up sent" : "Send follow-up email"}
      </Button>
      {error && (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--p-red)" }}>
          We couldn't send that follow-up. Please try again in a moment.
        </p>
      )}
    </Panel>
  );
}

const EVAL_LABELS: Record<string, string> = {
  full_name: "Full name",
  phone: "Phone",
  desired_monthly_income: "Desired monthly income",
  employment_status: "Employment status",
  time_commitment: "Time commitment",
  hours_per_week: "Hours per week",
  why_join: "Why join Vantage",
  why_you: "Why we should choose them",
  looking_for: "Looking for",
  path_interest: "Path interest",
  motivation: "Motivation",
  goal_12mo: "12-month goal",
  commission_comfort: "Commission comfort",
  willing_to_call: "Willing to call daily",
  coachable: "Coachable",
  start_timeframe: "Can start",
  comments: "Comments",
  licensing_status: "Licensing status",
  why: "Why join Vantage",
};
function evalFieldLabel(k: string): string {
  return EVAL_LABELS[k] ?? k.replace(/_/g, " ");
}

/* -------------------------------------------------------------------------- */
/* State exam scheduling + result                                             */
/* -------------------------------------------------------------------------- */

function StateExamCard({ applicant, onDone }: { applicant: any; onDone: () => void }) {
  const schedule = useServerFn(setApplicantExam);
  const mark = useServerFn(markExamResult);
  const followUp = useServerFn(startApplicantFollowUp);
  const [date, setDate] = useState(isoToLocalInput(applicant.exam_date));
  const [provider, setProvider] = useState(applicant.exam_provider ?? "");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      notify.success(message);
      onDone();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="State exam"
      description="Scheduling the exam moves them to State Exam and starts their reminder sequence."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Exam date & time">
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Provider / location">
          <Input
            value={provider}
            placeholder="PSI, Pearson VUE, online…"
            onChange={(e) => setProvider(e.target.value)}
          />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy || !date}
          onClick={() =>
            run(
              () =>
                schedule({
                  data: {
                    id: applicant.id,
                    exam_date: localInputToIso(date) ?? date,
                    exam_provider: provider,
                  },
                }),
              "Exam scheduled — reminders are on",
            )
          }
        >
          {applicant.exam_date ? "Update exam" : "Schedule exam"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() =>
            run(
              () => mark({ data: { id: applicant.id, result: "passed" } }),
              "Marked passed — moved to Licensing",
            )
          }
        >
          <Check size={14} aria-hidden /> Passed
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() =>
            run(() => mark({ data: { id: applicant.id, result: "failed" } }), "Marked not passed")
          }
        >
          Not passed
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() =>
            run(() => followUp({ data: { id: applicant.id } }), "Follow up sequence started")
          }
        >
          Start follow up
        </Button>
      </div>
      {applicant.exam_result && (
        <div className="mt-3">
          <Badge tone={applicant.exam_result === "passed" ? "green" : "red"}>
            {applicant.exam_result === "passed" ? "Passed" : "Not passed"}
          </Badge>
        </div>
      )}
    </Panel>
  );
}

function OnboardingProgressCard({ steps, applicantId }: { steps: unknown; applicantId: string }) {
  const qc = useQueryClient();
  const fetchContent = useServerFn(getOnboardingContent);
  const setStep = useServerFn(setAgentOnboardingStep);
  const contentQ = useQuery({ queryKey: ["onboarding", "content"], queryFn: () => fetchContent() });
  const s = (steps ?? {}) as Record<string, { completed?: boolean }>;
  const defs = contentQ.data?.steps ?? [];
  const list = defs.length
    ? defs.map((d: OnboardingStepRow) => ({ key: d.step_key, label: d.title, required: d.is_required }))
    : ONBOARDING_STEP_ORDER.map((k) => ({ key: k, label: ONBOARDING_STEP_LABELS[k], required: true }));
  const required = list.filter((x: { required: boolean }) => x.required);
  const total = required.length || list.length;
  const done = (required.length ? required : list).filter((x: { key: string }) => s[x.key]?.completed === true).length;

  const mut = useMutation({
    mutationFn: (v: { step: string; completed: boolean }) =>
      setStep({ data: { applicant_id: applicantId, step: v.step, completed: v.completed } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applicant"] });
      qc.invalidateQueries({ queryKey: ["applicants"] });
    },
  });

  return (
    <Panel
      title="Onboarding progress"
      actions={<Badge tone={done === total ? "green" : "gold"}>{done}/{total}</Badge>}
    >
      <div className="mb-3 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--p-hover)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.max(4, Math.round((done / Math.max(1, total)) * 100))}%`,
            background: "var(--p-gold)",
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        {list.map((item: { key: string; label: string; required: boolean }) => {
          const stepDone = s[item.key]?.completed === true;
          return (
            <button
              key={item.key}
              type="button"
              disabled={mut.isPending}
              onClick={() => mut.mutate({ step: item.key, completed: !stepDone })}
              className="flex items-center gap-2.5 rounded-[8px] px-1 py-1 text-left text-[13px] transition-colors hover:bg-[var(--p-hover)] disabled:opacity-60"
            >
              <span
                className="flex h-4 w-4 flex-none items-center justify-center rounded-full border"
                style={
                  stepDone
                    ? { borderColor: "var(--p-green)", background: "var(--p-green)", color: "var(--p-bg)" }
                    : { borderColor: "var(--p-border-strong)", color: "transparent" }
                }
                aria-hidden
              >
                <Check size={10} strokeWidth={3} />
              </span>
              <span className={stepDone ? "p-body" : "p-secondary"}>{item.label}</span>
              {!item.required && <Badge tone="neutral">Optional</Badge>}
            </button>
          );
        })}
      </div>
      <p className="p-muted mt-2 text-[12px]">Tap a step to confirm or undo it for this agent.</p>
    </Panel>
  );
}


function OverviewToggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: (v: boolean) => void }) {
  return (
    <Button
      variant={active ? "secondary" : "outline"}
      size="sm"
      aria-pressed={active}
      onClick={() => onToggle(!active)}
    >
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full border"
        style={
          active
            ? { borderColor: "var(--p-green)", background: "var(--p-green)", color: "var(--p-bg)" }
            : { borderColor: "var(--p-border-strong)", color: "transparent" }
        }
        aria-hidden
      >
        <Check size={10} strokeWidth={3} />
      </span>
      {label}
    </Button>
  );
}


/* -------------------------------------------------------------------------- */
/* Email history                                                              */
/* -------------------------------------------------------------------------- */

function ApplicantEmailHistory({ applicantId }: { applicantId: string }) {
  const listFn = useServerFn(listEmailHistory);
  const q = useQuery({
    queryKey: ["applicant", applicantId, "emails"],
    queryFn: () => listFn({ data: { applicantId, limit: 50 } }),
  });

  if (q.isLoading) return <ListSkeleton rows={5} />;
  if (q.isError) {
    return <EmptyState title="Couldn't load email history" description="Please try again." />;
  }
  const rows = (q.data ?? []) as any[];
  if (!rows.length) {
    return (
      <EmptyState
        title="No emails yet"
        description="Automated and manual emails to this applicant will appear here."
      />
    );
  }

  return (
    <Panel title="Emails" description="Everything sent to this applicant.">
      <div className="flex flex-col divide-y" style={{ borderColor: "var(--p-border)" }}>
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="p-secondary truncate font-medium">{r.subject || r.template_name}</div>
              <div className="p-muted">
                {new Date(r.created_at).toLocaleString()} · {r.template_name || r.template_key}
                {r.automated === false ? " · manual" : ""}
              </div>
            </div>
            <Badge
              tone={
                r.status === "sent" || r.status === "delivered"
                  ? "green"
                  : r.status === "failed" || r.status === "bounced"
                    ? "red"
                    : "amber"
              }
            >
              {r.status}
            </Badge>
          </div>
        ))}
      </div>
    </Panel>
  );
}
