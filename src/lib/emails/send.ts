// Legacy email entry point, now a thin adapter over the unified email system
// in `src/lib/email/`. Existing triggers keep calling `queueEmail`; delivery,
// preference gating, dedupe, and outbox logging all happen in the dispatcher.

import type { TemplateKey, TemplateParams } from "./templates";

type MinimalClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

/** Recruiting agent who should receive a copy of an applicant email. */
export type EmailCopyTarget = { email?: string | null; name?: string | null };

export type QueueEmailArgs = {
  to: string;
  toName?: string;
  applicantId?: string | null;
  template: TemplateKey;
  params?: Omit<TemplateParams, "links">;
  /** @deprecated Agents get their own stage notifications; copies are not sent. */
  copyTo?: EmailCopyTarget | null;
  /** @deprecated No longer used. */
  copyForName?: string | null;
};

/** Internal template key -> unified catalog template name. */
const TEMPLATE_NAMES: Record<TemplateKey, string> = {
  application_licensed: "application-licensed",
  application_unlicensed: "application-unlicensed",
  welcome_hired: "welcome-hired",
  followup_checkin: "followup-checkin",
  welcome_onboarding: "welcome-onboarding",
  onboarding_complete: "onboarding-complete",
};

/**
 * Send a branded Vantage email and log the outcome. Recruiting agents are not
 * copied on applicant email — they get their own stage notifications instead.
 * Never throws into the caller's flow.
 */
export async function queueEmail(
  _supabase: MinimalClient,
  { to, toName, applicantId, template, params }: QueueEmailArgs,
): Promise<void> {
  const email = to?.trim().toLowerCase();
  if (!email) return;

  try {
    const { sendEmail } = await import("@/lib/email/dispatch.server");
    await sendEmail({
      template: TEMPLATE_NAMES[template],
      to: email,
      toName: toName ?? null,
      applicantId: applicantId ?? null,
      sendKey: `${template}-${applicantId ?? email}`,
      context: {
        first_name: params?.firstName || undefined,
        full_name: toName || undefined,
        email,
        portal_link: params?.portalLink || undefined,
      },
    });
  } catch (e) {
    console.warn(`[email] ${template} -> ${email} failed:`, e);
  }
}

/** Details rendered in the agent's new-applicant alert. */
export type AgentApplicantAlert = {
  agentEmail?: string | null;
  agentName?: string | null;
  applicantId?: string | null;
  applicantName?: string;
  applicantEmail?: string;
  applicantPhone?: string;
  state?: string;
  licensed?: boolean;
  hasDownlines?: boolean;
  instagramHandle?: string;
  whyText?: string;
  /** Pre-formatted schedule line (CT slot, 1:1 request, or not scheduled). */
  scheduleLabel?: string;
  referredByName?: string;
  applicantUrl?: string;
};

/**
 * Notify the recruiting agent that a new applicant landed under them.
 * Best-effort — never throws into the submission flow.
 */
export async function sendAgentNewApplicant(
  supabase: MinimalClient,
  alert: AgentApplicantAlert,
): Promise<void> {
  const agentEmail = alert.agentEmail?.trim().toLowerCase();
  if (!agentEmail) return;

  const templateData: Record<string, unknown> = {
    agentName: firstNameFrom(alert.agentName),
    applicantName: alert.applicantName,
    applicantEmail: alert.applicantEmail,
    applicantPhone: alert.applicantPhone,
    state: alert.state,
    licensed: !!alert.licensed,
    hasDownlines: !!alert.hasDownlines,
    instagramHandle: alert.instagramHandle,
    whyText: alert.whyText,
    scheduleLabel: alert.scheduleLabel,
    referredByName: alert.referredByName,
    applicantUrl: alert.applicantUrl,
  };

  let status: "sent" | "failed" | "skipped" = "sent";
  let error: string | null = null;
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("agent-new-applicant", agentEmail, {
      templateData,
      idempotencyKey: `agent-new-applicant-${alert.applicantId ?? alert.applicantEmail ?? agentEmail}`,
    });
    if (!result.sent) {
      status = "skipped";
      error = result.reason;
    }
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
    console.warn(`[email] agent-new-applicant -> ${agentEmail} failed:`, error);
  }

  try {
    await supabase.rpc("enqueue_email", {
      payload: {
        to_email: agentEmail,
        to_name: alert.agentName ?? null,
        subject: `New applicant: ${alert.applicantName || "someone just applied"}`,
        html: "",
        template_key: "agent_new_applicant",
        template_name: "agent-new-applicant",
        category: "recruiting",
        applicant_id: alert.applicantId ?? null,
        status,
        error,
      },
    });
  } catch {
    /* logging is best-effort */
  }
}

export function firstNameFrom(fullName?: string | null, fallback?: string | null): string {
  const n = (fullName ?? "").trim();
  if (n) return n.split(/\s+/)[0];
  return (fallback ?? "").trim();
}
