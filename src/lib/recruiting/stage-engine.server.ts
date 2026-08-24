/**
 * The single stage engine for the Vantage recruiting journey.
 *
 * Every stage change — recruiter action, Calendly webhook, evaluation,
 * course-purchase link, onboarding completion — goes through `applyStage`.
 * It writes the stage, keeps status/stamps in sync, logs a timeline entry,
 * fires the stage email (with the recruiting agent's copy), and starts or
 * stops the automated sequences that belong to that stage.
 *
 * Server-only.
 */

import { randomBytes } from "crypto";

import { emailLinks, SITE_URL } from "@/lib/email/links";
import { formatDate, formatTime, formatWhen, type EmailContext } from "@/lib/email/vars";
import type { RecruitingStatus } from "@/lib/recruiting";

export type StageSlug =
  | "new-applicant"
  | "interview-scheduled"
  | "interview-completed"
  | "pre-licensing"
  | "state-exam"
  | "licensing"
  | "onboarding"
  | "training"
  | "active-agent"
  | "not-moving-forward";

export type SequenceKind =
  | "interview_reminders"
  | "exam_reminders"
  | "no_show_followup"
  /** Weekly invite to the company overview for applicants who never booked. */
  | "overview_invite"
  /** Twice-weekly pre-licensing / course / exam check-ins. */
  | "licensing_checkins";

/** Email fired when an applicant lands on a stage. */
export const STAGE_EMAIL: Partial<Record<StageSlug, string>> = {
  "interview-scheduled": "interview-confirmation",
  "interview-completed": "accepted",
  "pre-licensing": "pre-licensing",
  "state-exam": "state-exam-scheduled",
  licensing: "licensing-next-steps",
  onboarding: "welcome-onboarding",
  training: "training-instructions",
  "active-agent": "active-agent",
  "not-moving-forward": "not-moving-forward",
};

/** Stamp column set when the applicant enters a stage. */
const STAGE_STAMP: Partial<Record<StageSlug, string>> = {
  "interview-completed": "hired_at",
  "pre-licensing": "pre_licensing_at",
  licensing: "licensing_at",
  training: "training_started_at",
};

/** Status forced by entering a stage (others keep the recruiter's status). */
const STAGE_STATUS: Partial<Record<StageSlug, RecruitingStatus>> = {
  "interview-completed": "hired",
  "not-moving-forward": "terminated",
};

export const STAGE_LABELS: Record<StageSlug, string> = {
  "new-applicant": "New Applicant",
  "interview-scheduled": "Interview Scheduled",
  "interview-completed": "Interview Completed",
  "pre-licensing": "Pre Licensing",
  "state-exam": "State Exam",
  licensing: "Licensing",
  onboarding: "Onboarding",
  training: "Training",
  "active-agent": "Active",
  "not-moving-forward": "Terminated",
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export interface ApplicantRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  licensed: boolean | null;
  state: string | null;
  resident_state: string | null;
  npn: string | null;
  recruiting_status: string | null;
  current_stage_id: string | null;
  assigned_recruiter_id: string | null;
  original_recruiter_id: string | null;
  scheduled_event_start: string | null;
  scheduled_event_url: string | null;
  calendly_scheduled_at: string | null;
  requested_overview_at: string | null;
  exam_date: string | null;
  exam_provider: string | null;
  confirmation_token: string | null;
  portal_profile_id: string | null;
}

const APPLICANT_COLS =
  "id, first_name, last_name, email, phone, licensed, state, resident_state, npn, recruiting_status, current_stage_id, assigned_recruiter_id, original_recruiter_id, scheduled_event_start, scheduled_event_url, calendly_scheduled_at, requested_overview_at, exam_date, exam_provider, confirmation_token, portal_profile_id";

/**
 * Account-setup link for an applicant entering Onboarding. New agents have no
 * portal account yet, so every path into Onboarding must hand them a
 * single-use invitation link instead of a login wall. Existing accounts keep
 * going to the portal. Never throws.
 */
export async function onboardingAccountLink(a: ApplicantRow): Promise<string> {
  if (a.portal_profile_id) return `${SITE_URL}/portal/onboarding`;
  if (!a.email) return `${SITE_URL}/login`;
  try {
    const supabase = await db();
    const { data: res, error } = await supabase.rpc("ensure_onboarding_invitation", {
      _applicant_id: a.id,
    });
    if (error) throw new Error(error.message);
    const token: string | undefined = res?.token;
    if (res?.ok && token) return `${SITE_URL}/portal-invite/${token}`;
  } catch (e) {
    console.warn("[recruiting] onboarding invite link failed:", (e as Error).message);
  }
  return `${SITE_URL}/login`;
}

export async function loadApplicant(applicantId: string): Promise<ApplicantRow | null> {
  const supabase = await db();
  const { data } = await supabase
    .from("applicants")
    .select(APPLICANT_COLS)
    .eq("id", applicantId)
    .maybeSingle();
  return (data as ApplicantRow) ?? null;
}

/** Matches by email first, then phone (digits only), newest record wins. */
export async function findApplicant(
  email?: string | null,
  phone?: string | null,
): Promise<ApplicantRow | null> {
  const supabase = await db();
  if (email?.trim()) {
    const { data } = await supabase
      .from("applicants")
      .select(APPLICANT_COLS)
      .ilike("email", email.trim())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as ApplicantRow;
  }
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length >= 7) {
    const tail = digits.slice(-7);
    const { data } = await supabase
      .from("applicants")
      .select(APPLICANT_COLS)
      .ilike("phone", `%${tail}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as ApplicantRow;
  }
  return null;
}

export async function stageIdBySlug(slug: StageSlug): Promise<string | null> {
  const supabase = await db();
  const { data } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

export async function stageSlugById(id: string | null): Promise<StageSlug | null> {
  if (!id) return null;
  const supabase = await db();
  const { data } = await supabase
    .from("pipeline_stages")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  return (data?.slug as StageSlug) ?? null;
}

export async function logActivity(
  applicantId: string,
  eventType: string,
  summary: string,
  data: Record<string, unknown> = {},
  actorId?: string | null,
): Promise<void> {
  try {
    const supabase = await db();
    await supabase.from("applicant_activities").insert({
      applicant_id: applicantId,
      actor_id: actorId ?? null,
      event_type: eventType,
      summary,
      data,
    });
  } catch (e) {
    console.warn("[recruiting] activity log failed:", e);
  }
}

export async function createActionToken(
  applicantId: string,
  action: string,
  days = 120,
): Promise<string> {
  const supabase = await db();
  const { data: existing } = await supabase
    .from("applicant_action_tokens")
    .select("token, expires_at, used_at")
    .eq("applicant_id", applicantId)
    .eq("action", action)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.token) return existing.token as string;

  const token = randomBytes(24).toString("base64url");
  await supabase.from("applicant_action_tokens").insert({
    applicant_id: applicantId,
    action,
    token,
    expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
  });
  return token;
}

export type ClaimResult =
  | { ok: true; applicantId: string; firstClaim: boolean }
  | { ok: false; reason: "invalid" | "expired" };

export async function claimActionToken(token: string, action: string): Promise<ClaimResult> {
  const supabase = await db();
  const { data: row } = await supabase
    .from("applicant_action_tokens")
    .select("id, applicant_id, expires_at, used_at")
    .eq("token", token)
    .eq("action", action)
    .maybeSingle();
  if (!row) return { ok: false, reason: "invalid" };
  if (row.used_at) return { ok: true, applicantId: row.applicant_id, firstClaim: false };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };

  const { data: claimed } = await supabase
    .from("applicant_action_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  return { ok: true, applicantId: row.applicant_id, firstClaim: !!claimed };
}

/** Minutes before the appointment for each interview/overview reminder touch. */
export const INTERVIEW_TOUCH_MINUTES = [8640, 5760, 2880, 1440, 180, 30];
/** Template per interview reminder touch (same order as the minutes above). */
export const INTERVIEW_TOUCH_TEMPLATES = [
  "interview-reminder",
  "interview-reminder",
  "interview-reminder",
  "interview-reminder",
  "interview-reminder-soon",
  "interview-reminder-final",
];
export const EXAM_TOUCH_HOURS = [72, 24, 6];
export const NO_SHOW_TOUCH_HOURS = [0, 48, 96];
/** Weekly overview invites stop after this many sends. */
export const OVERVIEW_INVITE_MAX_TOUCHES = 4;

function nextInterviewSend(anchorIso: string, touch: number): string | null {
  const anchor = new Date(anchorIso).getTime();
  for (let i = touch; i < INTERVIEW_TOUCH_MINUTES.length; i++) {
    const at = anchor - INTERVIEW_TOUCH_MINUTES[i] * 60_000;
    if (at > Date.now()) return new Date(at).toISOString();
  }
  return null;
}

function nextExamSend(anchorIso: string, touch: number): string | null {
  const anchor = new Date(anchorIso).getTime();
  for (let i = touch; i < EXAM_TOUCH_HOURS.length; i++) {
    const at = anchor - EXAM_TOUCH_HOURS[i] * 3600_000;
    if (at > Date.now()) return new Date(at).toISOString();
  }
  return null;
}

/**
 * The next moment (UTC) after `from` that falls on one of `weekdays`
 * (0 = Sunday) at 12:00 UTC — 7:00 AM CT during daylight time.
 */
export function nextWeekdaySlot(weekdays: number[], from = Date.now()): string {
  const d = new Date(from);
  for (let i = 0; i <= 8; i++) {
    const candidate = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + i, 12, 0, 0),
    );
    if (candidate.getTime() > from && weekdays.includes(candidate.getUTCDay())) {
      return candidate.toISOString();
    }
  }
  return new Date(from + 7 * 86_400_000).toISOString();
}

export function sequenceNextSend(
  kind: SequenceKind,
  anchorIso: string,
  touch: number,
): string | null {
  if (kind === "interview_reminders") return nextInterviewSend(anchorIso, touch);
  if (kind === "exam_reminders") return nextExamSend(anchorIso, touch);
  if (kind === "overview_invite") {
    if (touch >= OVERVIEW_INVITE_MAX_TOUCHES) return null;
    // Thursday mornings.
    return nextWeekdaySlot([4]);
  }
  if (kind === "licensing_checkins") {
    // Tuesday + Friday mornings, for as long as they're eligible.
    return nextWeekdaySlot([2, 5]);
  }
  if (touch >= NO_SHOW_TOUCH_HOURS.length) return null;
  return new Date(new Date(anchorIso).getTime() + NO_SHOW_TOUCH_HOURS[touch] * 3600_000).toISOString();
}

export async function startSequence(
  applicantId: string,
  kind: SequenceKind,
  anchorIso: string,
): Promise<void> {
  const next = sequenceNextSend(kind, anchorIso, 0);
  const supabase = await db();
  await supabase.from("applicant_sequences").upsert(
    {
      applicant_id: applicantId,
      kind,
      status: next ? "active" : "done",
      touch_count: 0,
      anchor_at: anchorIso,
      next_send_at: next,
      stop_reason: null,
    },
    { onConflict: "applicant_id,kind" },
  );
}

/**
 * Start a sequence only if the applicant isn't already in it. Used by the
 * recurring enrollment sweeps so a nightly re-scan never rewinds someone's
 * touch count.
 */
export async function ensureSequence(
  applicantId: string,
  kind: SequenceKind,
  anchorIso: string,
): Promise<boolean> {
  const supabase = await db();
  const { data: existing } = await supabase
    .from("applicant_sequences")
    .select("id")
    .eq("applicant_id", applicantId)
    .eq("kind", kind)
    .maybeSingle();
  if (existing) return false;
  await startSequence(applicantId, kind, anchorIso);
  return true;
}



export async function stopSequence(
  applicantId: string,
  kind: SequenceKind,
  reason: string,
): Promise<void> {
  const supabase = await db();
  await supabase
    .from("applicant_sequences")
    .update({ status: "stopped", next_send_at: null, stop_reason: reason })
    .eq("applicant_id", applicantId)
    .eq("kind", kind)
    .eq("status", "active");
}

export async function stopAllSequences(applicantId: string, reason: string): Promise<void> {
  const supabase = await db();
  await supabase
    .from("applicant_sequences")
    .update({ status: "stopped", next_send_at: null, stop_reason: reason })
    .eq("applicant_id", applicantId)
    .eq("status", "active");
}

export interface RecruiterInfo {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  one_on_one_calendly_url?: string | null;
  licensed_calendly_url?: string | null;
}

export async function loadRecruiter(a: ApplicantRow): Promise<RecruiterInfo | null> {
  const id = a.assigned_recruiter_id ?? a.original_recruiter_id;
  if (!id) return null;
  const supabase = await db();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, one_on_one_calendly_url, licensed_calendly_url")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.full_name ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    one_on_one_calendly_url: data.one_on_one_calendly_url ?? null,
    licensed_calendly_url: data.licensed_calendly_url ?? null,
  };
}

async function settingValue(key: string): Promise<string | null> {
  try {
    const supabase = await db();
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    const v = (data?.value ?? "").trim();
    return v || null;
  } catch {
    return null;
  }
}

/** Full variable context for any applicant email. */
export async function applicantContext(
  a: ApplicantRow,
  extra: EmailContext = {},
): Promise<EmailContext> {
  const recruiter = await loadRecruiter(a);
  const interviewAt = a.scheduled_event_start ?? a.calendly_scheduled_at ?? a.requested_overview_at;
  const rescheduleUrl =
    a.scheduled_event_url ??
    recruiter?.one_on_one_calendly_url ??
    recruiter?.licensed_calendly_url ??
    `${SITE_URL}/schedule`;
  const cheatSheet = await settingValue("licensing_cheat_sheet_url");
  const courseToken = await createActionToken(a.id, "course_purchased");
  
  // If they are in onboarding and have no portal account, we must use the invite link
  // across all variables that point to the portal/onboarding.
  const onboardingLink = a.portal_profile_id ? undefined : await onboardingAccountLink(a);

  return {
    ...emailLinks(),
    first_name: a.first_name ?? undefined,
    last_name: a.last_name ?? undefined,
    full_name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || undefined,
    applicant_name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || undefined,
    email: a.email ?? undefined,
    phone: a.phone ?? undefined,
    state: a.resident_state ?? a.state ?? undefined,
    recruiter_name: recruiter?.name ?? undefined,
    recruiter_email: recruiter?.email ?? undefined,
    recruiter_phone: recruiter?.phone ?? undefined,
    interview_date: formatDate(interviewAt) ?? undefined,
    interview_time: formatTime(interviewAt) ?? undefined,
    interview_when: formatWhen(interviewAt) ?? undefined,
    overview_date: formatDate(interviewAt) ?? undefined,
    overview_time: formatTime(interviewAt) ?? undefined,
    overview_when: formatWhen(interviewAt) ?? undefined,
    reschedule_link: rescheduleUrl,
    one_on_one_link: recruiter?.one_on_one_calendly_url ?? `${SITE_URL}/schedule`,
    exam_date: formatDate(a.exam_date) ?? undefined,
    exam_time: formatTime(a.exam_date) ?? undefined,
    exam_when: formatWhen(a.exam_date) ?? undefined,
    exam_provider: a.exam_provider ?? undefined,
    course_confirm_link: `${SITE_URL}/course-purchased/${courseToken}`,
    cheat_sheet_link: cheatSheet ?? undefined,
    instagram_link: "https://instagram.com/vantage.financial",
    // Override links if a tokenized onboarding link is available
    ...(onboardingLink ? {
      onboarding_link: onboardingLink,
      invitation_link: onboardingLink,
      portal_link: onboardingLink,
    } : {}),
    ...extra,
  } as EmailContext;
}

/** Send an applicant email. Recruiters are notified separately on stage moves. */
export async function sendApplicantEmail(
  a: ApplicantRow,
  template: string,
  opts: { context?: EmailContext; sendKey?: string; actorId?: string | null } = {},
): Promise<void> {
  if (!a.email) return;
  const { sendEmail } = await import("@/lib/email/dispatch.server");
  const context = await applicantContext(a, opts.context ?? {});
  await sendEmail({
    template,
    to: a.email,
    toName: context.full_name ?? undefined,
    applicantId: a.id,
    context,
    sendKey: opts.sendKey ?? null,
    sentBy: opts.actorId ?? null,
    automated: !opts.actorId,
  });
}

/**
 * Tell the recruiting agent one of their applicants moved forward. Sent once
 * per applicant per stage; preference-gated like every other agent email.
 */
export async function notifyRecruiterStage(
  a: ApplicantRow,
  to: StageSlug,
  from: StageSlug | null,
): Promise<void> {
  const recruiter = await loadRecruiter(a);
  if (!recruiter?.email) return;
  if (recruiter.email.trim().toLowerCase() === (a.email ?? "").trim().toLowerCase()) return;

  const { sendEmail } = await import("@/lib/email/dispatch.server");
  const applicantName = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || a.email || "Your applicant";
  
  await sendEmail({
    template: "agent-stage-notification",
    to: recruiter.email,
    toName: recruiter.name || null,
    profileId: recruiter.id,
    context: {
      ...emailLinks({ portal_link: `${SITE_URL}/portal/crm/${a.id}` }),
      applicant_name: applicantName,
      stage_name: STAGE_LABELS[to],
      previous_stage: from ? STAGE_LABELS[from] : "New Applicant",
    },
    sendKey: `recruiter-stage-${a.id}-${to}`,
    automated: true,
  });
}

/** The master entry point for moving an applicant through the funnel. */
export async function applyStage(args: {
  applicantId: string;
  stage: StageSlug;
  reason?: string;
  sendKey?: string;
  actorId?: string | null;
  /** Skip the stage email (e.g. the caller sends a richer one itself). */
  skipEmail?: boolean;
  /** Extra email variables for the stage email. */
  context?: EmailContext;
  /** Dedupe suffix for the stage email. */
  dedupeKey?: string;
  /** Extra applicant columns to write alongside the stage change. */
  patch?: Record<string, any>;
}): Promise<{ ok: true }> {
  const applicant = await loadApplicant(args.applicantId);
  if (!applicant) throw new Error("Applicant not found");
  
  const fromStage = await stageSlugById(applicant.current_stage_id);
  if (fromStage === args.stage) {
    // Already at this stage — still persist any extra column updates.
    if (args.patch && Object.keys(args.patch).length) {
      const sb = await db();
      const { error: patchErr } = await sb
        .from("applicants")
        .update({ ...args.patch, updated_at: new Date().toISOString() })
        .eq("id", args.applicantId);
      if (patchErr) throw new Error(patchErr.message);
    }
    return { ok: true };
  }

  const stageId = await stageIdBySlug(args.stage);
  if (!stageId) throw new Error(`Invalid stage: ${args.stage}`);

  const supabase = await db();
  const stamp = STAGE_STAMP[args.stage];
  const status = STAGE_STATUS[args.stage];
  
  const patch: Record<string, any> = {
    current_stage_id: stageId,
    stage_entered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (stamp) patch[stamp] = patch.stage_entered_at;
  if (status) patch.recruiting_status = status;
  if (args.patch) Object.assign(patch, args.patch);

  const { error } = await supabase
    .from("applicants")
    .update(patch)
    .eq("id", args.applicantId);
  if (error) throw new Error(error.message);

  const fresh = await loadApplicant(args.applicantId);
  if (!fresh) return { ok: true };

  await logActivity(
    args.applicantId,
    "stage_changed",
    `Moved to ${STAGE_LABELS[args.stage]}`,
    { from: fromStage, to: args.stage, reason: args.reason },
    args.actorId
  );

  await notifyRecruiterStage(fresh, args.stage, fromStage);

  const template = STAGE_EMAIL[args.stage];
  if (template && !args.skipEmail) {
    await sendApplicantEmail(fresh, template, {
      context: args.context,
      sendKey: args.sendKey || args.dedupeKey,
      actorId: args.actorId,
    });
  }

  // Manage sequences
  if (args.stage !== "interview-scheduled") {
    await stopSequence(args.applicantId, "interview_reminders", `Moved to ${args.stage}`);
  }
  if (args.stage !== "state-exam") {
    await stopSequence(args.applicantId, "exam_reminders", `Moved to ${args.stage}`);
  }

  return { ok: true };
}
