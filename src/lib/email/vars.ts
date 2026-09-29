/**
 * Email variable context + token interpolation.
 *
 * Every Vantage email is rendered from a single flat context object, so no
 * template invents its own variable names and nothing can ship with an
 * unresolved `{{token}}` in it. Client-safe: pure data + string work.
 */

export type EmailVarKey =
  | "first_name"
  | "last_name"
  | "full_name"
  | "email"
  | "phone"
  | "recruiter_name"
  | "agency_name"
  | "interview_date"
  | "interview_time"
  | "interview_when"
  | "overview_date"
  | "overview_time"
  | "overview_when"
  | "evaluation_link"
  | "onboarding_link"
  | "portal_link"
  | "academy_link"
  | "calendar_link"
  | "preferences_link"
  | "course_link"
  | "discord_link"
  | "agent_cloud_link"
  | "overview_link"
  | "one_on_one_link"
  | "invitation_link"
  | "reset_link"
  | "verification_link"
  | "training_link"
  | "course_name"
  | "event_name"
  | "event_when"
  | "next_step"
  | "progress"
  | "deadline"
  | "message"
  | "score"
  | "sender_name"
  | "subject_line"
  | "target"
  | "dial_hours"
  | "mindset"
  | "focus"
  | "meeting_time"
  | "training_time"
  | "film_review"
  | "dial_expectation"
  | "tip_title"
  | "tip_body"
  | "state"
  | "applicant_name"
  | "recruiter_email"
  | "recruiter_phone"
  | "reschedule_link"
  | "vsl_link"
  | "exam_date"
  | "exam_time"
  | "exam_when"
  | "exam_provider"
  | "course_confirm_link"
  | "cheat_sheet_link"
  | "instagram_link"
  | "weekly_schedule"
  | "agency_code"
  | "stage_name"
  | "previous_stage"
  | "state_requirements_link"
  | "nipr_link";

export type EmailContext = Partial<Record<EmailVarKey, string | null | undefined>>;

export const AGENCY_NAME = "Vantage Financial";

/** Every variable admins may reference, for the template editor's help list. */
export const EMAIL_VAR_KEYS: EmailVarKey[] = [
  "first_name",
  "last_name",
  "full_name",
  "email",
  "phone",
  "recruiter_name",
  "agency_name",
  "interview_date",
  "interview_time",
  "interview_when",
  "overview_date",
  "overview_time",
  "overview_when",
  "evaluation_link",
  "onboarding_link",
  "portal_link",
  "academy_link",
  "calendar_link",
  "preferences_link",
  "course_link",
  "discord_link",
  "agent_cloud_link",
  "overview_link",
  "one_on_one_link",
  "vsl_link",
  "invitation_link",
  "reset_link",
  "verification_link",
  "training_link",
  "course_name",
  "event_name",
  "event_when",
  "next_step",
  "progress",
  "deadline",
  "message",
  "score",
  "sender_name",
  "subject_line",
  "target",
  "dial_hours",
  "mindset",
  "focus",
  "meeting_time",
  "training_time",
  "film_review",
  "dial_expectation",
  "tip_title",
  "tip_body",
  "state",
  "applicant_name",
  "recruiter_email",
  "recruiter_phone",
  "reschedule_link",
  "vsl_link",
  "exam_date",
  "exam_time",
  "exam_when",
  "exam_provider",
  "course_confirm_link",
  "cheat_sheet_link",
  "nipr_link",
  "instagram_link",
  "weekly_schedule",
  "agency_code",
  "stage_name",
  "previous_stage",
  "state_requirements_link",
];

const TOKEN = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Tokens referenced by a string. */
export function tokensIn(text: string | undefined | null): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const m of text.matchAll(TOKEN)) out.push(m[1]);
  return out;
}

export type Interpolated = { text: string; missing: string[] };

/** Replace `{{tokens}}`; reports any token the context can't fill. */
export function interpolate(text: string, ctx: EmailContext): Interpolated {
  const missing: string[] = [];
  const out = text.replace(TOKEN, (_all, key: string) => {
    const value = ctx[key as EmailVarKey];
    const str = value == null ? "" : String(value).trim();
    if (!str) {
      missing.push(key);
      return "";
    }
    return str;
  });
  return { text: out.replace(/\s{2,}/g, " ").trim(), missing };
}

/** Interpolate, or return null when anything is unresolved (drop the line). */
export function interpolateStrict(
  text: string | undefined | null,
  ctx: EmailContext,
): string | null {
  if (!text || !text.trim()) return null;
  const { text: out, missing } = interpolate(text, ctx);
  if (missing.length > 0) return null;
  return out || null;
}

const TZ_LABELS: Record<string, string> = {
  "America/Chicago": "CT",
  "America/New_York": "ET",
  "America/Denver": "MT",
  "America/Phoenix": "MST",
  "America/Los_Angeles": "PT",
  "America/Anchorage": "AKT",
  "Pacific/Honolulu": "HT",
};

export const DEFAULT_TZ = "America/Chicago";

function zone(tz?: string | null): string {
  return tz && TZ_LABELS[tz] ? tz : DEFAULT_TZ;
}

export function zoneLabel(tz?: string | null): string {
  return TZ_LABELS[zone(tz)] ?? "CT";
}

/** "Monday, August 18" in the recipient's zone. */
export function formatDate(iso?: string | null, tz?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone(tz),
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}

/** "7:00 PM CT" in the recipient's zone. */
export function formatTime(iso?: string | null, tz?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone(tz),
      hour: "numeric",
      minute: "2-digit",
    }).format(d) + ` ${zoneLabel(tz)}`
  );
}

/** "Monday, August 18 at 7:00 PM CT" */
export function formatWhen(iso?: string | null, tz?: string | null): string | null {
  const date = formatDate(iso, tz);
  const time = formatTime(iso, tz);
  if (!date || !time) return null;
  return `${date} at ${time}`;
}

export function firstNameOf(full?: string | null, fallback = ""): string {
  const n = (full ?? "").trim();
  if (!n) return fallback;
  return n.split(/\s+/)[0];
}
