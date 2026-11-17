/**
 * The single send path for every Vantage email.
 *
 * Responsibilities: template override lookup, notification-preference gating,
 * atomic deduplication, delivery through Lovable's managed API, and outbox
 * logging. Never throws into a caller's flow — a failed email is logged, not
 * propagated.
 *
 * Server-only.
 */

import { templateDef, type PrefKey } from "./catalog";
import { renderEmail, type TemplateOverride } from "./render.server";
import { AGENCY_NAME, type EmailContext } from "./vars";
import { sendRawEmail } from "@/lib/email-templates/send-email";

export interface SendArgs {
  template: string;
  to: string;
  toName?: string | null;
  context?: EmailContext;
  applicantId?: string | null;
  profileId?: string | null;
  /** Dedupe key — a second send with the same key is skipped entirely. */
  sendKey?: string | null;
  /** Recruiting agent's copy — banner names this applicant. */
  copyFor?: string | null;
  /** Who triggered it; null for automated sends. */
  sentBy?: string | null;
  automated?: boolean;
  campaignSlug?: string | null;
  replyTo?: string | null;
  /** Skip preference gating (security + required operational emails). */
  ignorePrefs?: boolean;
}

export type SendResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadOverride(templateName: string): Promise<TemplateOverride | null> {
  try {
    const db = await admin();
    const { data } = await db
      .from("email_templates")
      .select("subject_override, body_override, enabled")
      .eq("template_name", templateName)
      .maybeSingle();
    if (!data) return null;
    if (data.enabled === false) return { subject: null };
    const body = (data.body_override ?? {}) as Record<string, string | null>;
    return {
      subject: data.subject_override,
      title: body["title"] ?? null,
      intro: body["intro"] ?? null,
      body: body["body"] ?? null,
      note: body["note"] ?? null,
      cta_label: body["cta_label"] ?? null,
      cta_url: body["cta_url"] ?? null,
      secondary_cta_label: body["secondary_cta_label"] ?? null,
      secondary_cta_url: body["secondary_cta_url"] ?? null,
    };
  } catch {
    return null;
  }
}

/** False when the recipient has switched this category off. */
async function prefAllows(profileId: string, prefKey: PrefKey): Promise<boolean> {
  try {
    const db = await admin();
    const { data } = await db
      .from("profiles")
      .select("notification_prefs, timezone")
      .eq("id", profileId)
      .maybeSingle();
    const prefs = (data?.notification_prefs ?? {}) as Record<string, unknown>;
    if (prefs["email_enabled"] === false || prefs["email_notifications"] === false) return false;
    return prefs[prefKey] !== false;
  } catch {
    return true;
  }
}

/** True when the recipient belongs to a portal account an admin deactivated. */
async function isDeactivatedRecipient(email: string, profileId?: string | null): Promise<boolean> {
  try {
    const db = await admin();
    let q = db.from("profiles").select("id").eq("is_active", false).limit(1);
    q = profileId ? q.or(`id.eq.${profileId},email.ilike.${email}`) : q.ilike("email", email);
    const { data } = await q;
    return (data ?? []).length > 0;
  } catch {
    return false;
  }
}

async function claimKey(sendKey?: string | null): Promise<boolean> {
  if (!sendKey) return true;
  try {
    const db = await admin();
    const { data, error } = await db.rpc("email_claim_send", { _key: sendKey });
    if (error) return true; // never block a send on the dedupe table
    return data !== false;
  } catch {
    return true;
  }
}

async function log(payload: Record<string, unknown>): Promise<void> {
  try {
    const db = await admin();
    await db.rpc("enqueue_email", { payload: payload as never });
  } catch (e) {
    console.warn("[email] outbox log failed:", e);
  }
}

/** Templates that must always deliver, regardless of preferences. */
function isRequired(templateName: string): boolean {
  const def = templateDef(templateName);
  return !def?.prefKey;
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const def = templateDef(args.template);
  if (!def) return { status: "failed", error: `Unknown template ${args.template}` };

  const to = args.to?.trim().toLowerCase();
  if (!to) return { status: "skipped", reason: "no_recipient" };

  if (await isDeactivatedRecipient(to, args.profileId)) {
    return { status: "skipped", reason: "account_inactive" };
  }

  if (def.prefKey && args.profileId && !args.ignorePrefs) {
    const allowed = await prefAllows(args.profileId, def.prefKey);
    if (!allowed) return { status: "skipped", reason: "opted_out" };
  }

  const sendKey = args.sendKey ? `${args.template}:${args.sendKey}` : null;
  if (!(await claimKey(sendKey))) return { status: "skipped", reason: "duplicate" };

  const override = await loadOverride(args.template);
  const context: EmailContext = { agency_name: AGENCY_NAME, ...(args.context ?? {}) };

  let rendered;
  try {
    rendered = await renderEmail(args.template, {
      context,
      override,
      copyFor: args.copyFor,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await log({
      to_email: to,
      to_name: args.toName ?? null,
      subject: "",
      html: "",
      template_key: args.template,
      template_name: args.template,
      category: def.category,
      applicant_id: args.applicantId ?? null,
      profile_id: args.profileId ?? null,
      automated: args.automated ?? true,
      sent_by: args.sentBy ?? null,
      campaign_slug: args.campaignSlug ?? null,
      status: "failed",
      error: `render: ${error}`,
    });
    return { status: "failed", error };
  }

  let status: "sent" | "failed" | "skipped" = "sent";
  let error: string | null = null;
  try {
    const result = await sendRawEmail(to, rendered.subject, rendered.html, {
      idempotencyKey: sendKey ?? undefined,
      replyTo: args.replyTo ?? undefined,
      text: rendered.text,
    });
    if (!result.sent) {
      status = "skipped";
      error = result.reason;
    }
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
    console.warn(`[email] send failed ${args.template} -> ${to}:`, error);
  }

  await log({
    to_email: to,
    to_name: args.toName ?? null,
    subject: rendered.subject,
    html: rendered.html,
    template_key: args.template,
    template_name: args.template,
    category: def.category,
    applicant_id: args.applicantId ?? null,
    profile_id: args.profileId ?? null,
    automated: args.automated ?? true,
    sent_by: args.sentBy ?? null,
    campaign_slug: args.campaignSlug ?? null,
    cta_url: def.body.ctaUrl ?? null,
    status,
    error,
    meta: rendered.missing.length ? { missing_vars: rendered.missing } : {},
  });

  if (status === "sent") return { status: "sent" };
  if (status === "skipped") return { status: "skipped", reason: error ?? "skipped" };
  return { status: "failed", error: error ?? "unknown" };
}

/** Free-form recruiter-composed email — still branded, logged, and deduped. */
export async function sendComposed(args: {
  to: string;
  toName?: string | null;
  subject: string;
  message: string;
  context?: EmailContext;
  applicantId?: string | null;
  sentBy?: string | null;
  replyTo?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}): Promise<SendResult> {
  return sendEmail({
    template: "agency-announcement",
    to: args.to,
    toName: args.toName,
    applicantId: args.applicantId,
    sentBy: args.sentBy,
    automated: false,
    replyTo: args.replyTo,
    ignorePrefs: true,
    context: {
      ...(args.context ?? {}),
      subject_line: args.subject,
      message: args.message,
    },
  });
}

export { isRequired };
