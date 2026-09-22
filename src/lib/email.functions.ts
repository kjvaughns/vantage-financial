import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { EMAIL_TEMPLATE_LIST, composerTemplates, templateDef } from "@/lib/email/catalog";
import { EMAIL_VAR_KEYS } from "@/lib/email/vars";

/**
 * Mint a one-time Supabase recovery link for an existing portal account so the
 * branded "Password reset link" email can carry it.
 */
async function buildPasswordResetLink(email: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { SITE_URL } = await import("@/lib/email/links");
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${SITE_URL}/reset-password` },
  });
  if (error || !data?.properties?.action_link) {
    throw new Error(
      "This person doesn't have a portal account yet, so there's no password to reset. Send them their portal invitation instead.",
    );
  }
  return data.properties.action_link;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.some((r: string) => r === "admin" || r === "super_admin")) {
    throw new Error("Forbidden: admin only");
  }
}

/** Catalog metadata for the admin editor and the recruiter composer. */
export const listEmailTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data } = await supabase.from("email_templates").select("*");
    const overrides = new Map((data ?? []).map((r: any) => [r.template_name, r]));
    return {
      vars: EMAIL_VAR_KEYS,
      templates: EMAIL_TEMPLATE_LIST.map((t) => ({
        name: t.name,
        label: t.label,
        audience: t.audience,
        category: t.category,
        trigger: t.trigger,
        prefKey: t.prefKey ?? null,
        manualOnly: !!t.manualOnly,
        defaults: {
          subject: t.subject,
          title: t.body.title,
          intro: t.body.intro ?? "",
          body: (t.body.lines ?? []).join("\n"),
          note: t.body.note ?? "",
          cta_label: t.body.ctaLabel ?? "",
          cta_url: t.body.ctaUrl ?? "",
          secondary_cta_label: t.body.secondaryCtaLabel ?? "",
          secondary_cta_url: t.body.secondaryCtaUrl ?? "",
        },
        override: overrides.get(t.name) ?? null,
      })),
    };
  });

const overrideSchema = z.object({
  template_name: z.string().min(1),
  subject_override: z.string().max(300).nullable().optional(),
  enabled: z.boolean().optional(),
  body_override: z
    .object({
      title: z.string().max(200).optional(),
      intro: z.string().max(500).optional(),
      body: z.string().max(4000).optional(),
      note: z.string().max(500).optional(),
      cta_label: z.string().max(80).optional(),
      cta_url: z.string().max(500).optional(),
      secondary_cta_label: z.string().max(80).optional(),
      secondary_cta_url: z.string().max(500).optional(),
    })
    .default({}),
});

export const saveEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => overrideSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (!templateDef(data.template_name)) throw new Error("Unknown template");
    const clean = Object.fromEntries(
      Object.entries(data.body_override).filter(([, v]) => (v ?? "").toString().trim() !== ""),
    );
    const { error } = await supabase.from("email_templates").upsert(
      {
        template_name: data.template_name,
        subject_override: data.subject_override?.trim() || null,
        body_override: clean as never,
        enabled: data.enabled ?? true,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "template_name" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ template_name: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    await supabase.from("email_templates").delete().eq("template_name", data.template_name);
    return { ok: true };
  });

/** Render one template with sample data so admins can see their copy. */
export const previewEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ template_name: z.string().min(1) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { renderEmail } = await import("@/lib/email/render.server");
    const { sampleContext } = await import("@/lib/email/sample");
    const { data: row } = await supabase
      .from("email_templates")
      .select("subject_override, body_override, enabled")
      .eq("template_name", data.template_name)
      .maybeSingle();
    const body = ((row?.body_override ?? {}) as Record<string, string>) || {};
    const rendered = await renderEmail(data.template_name, {
      context: sampleContext(),
      override: row
        ? {
            subject: row.subject_override,
            title: body["title"] ?? null,
            intro: body["intro"] ?? null,
            body: body["body"] ?? null,
            note: body["note"] ?? null,
            cta_label: body["cta_label"] ?? null,
            cta_url: body["cta_url"] ?? null,
            secondary_cta_label: body["secondary_cta_label"] ?? null,
            secondary_cta_url: body["secondary_cta_url"] ?? null,
          }
        : null,
    });
    return { subject: rendered.subject, html: rendered.html, missing: rendered.missing };
  });

/** Email history for an applicant, an agent, or the whole agency (admin). */
export const listEmailHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        applicantId: z.string().uuid().optional(),
        profileId: z.string().uuid().optional(),
        limit: z.number().min(1).max(200).default(50),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase
      .from("email_outbox")
      .select(
        "id, created_at, to_email, to_name, subject, template_name, template_key, category, status, error, automated, campaign_slug, sent_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.applicantId) q = q.eq("applicant_id", data.applicantId);
    if (data.profileId) q = q.eq("profile_id", data.profileId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Templates a recruiter may pick in the Send Email composer. */
export const listComposerTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () =>
    composerTemplates().map((t) => ({
      name: t.name,
      label: t.label,
      category: t.category,
      subject: t.subject,
      intro: t.body.intro ?? "",
      body: (t.body.lines ?? []).join("\n\n"),
    })),
  );

/** Send an applicant email — a catalog template or free-form copy. */
export const sendApplicantEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        applicantId: z.string().uuid(),
        template: z.string().min(1).optional(),
        subject: z.string().trim().min(1).max(300).optional(),
        message: z.string().trim().min(1).max(8000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { loadApplicant, sendApplicantEmail: sendRecruitingEmail, applicantContext } = await import(
      "@/lib/recruiting/stage-engine.server"
    );
    
    const applicant = await loadApplicant(data.applicantId);
    if (!applicant) throw new Error("Applicant not found.");
    if (!applicant.email) throw new Error("This applicant has no email on file.");

    const { data: me } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();

    const stamp = new Date().toISOString();
    
    // If a named catalog template is used, use the recruiting engine's send path
    // which handles the complex link resolution (invite vs login).
    if (data.template) {
      const extra: Record<string, string> = {};
      if (data.template === "password-reset") {
        extra.reset_link = await buildPasswordResetLink(applicant.email);
      }
      const result = await sendRecruitingEmail(applicant, data.template, {
        actorId: userId,
        sendKey: `manual-${data.template}-${applicant.id}-${stamp}`,
        context: extra,
      });
      return result;
    }

    // Composed free-form message
    if (!data.subject || !data.message) throw new Error("Subject and message are required.");
    
    // Construct rich context (including the tokenized onboarding link if applicable)
    const ctx = await applicantContext(applicant, {
      recruiter_name: me?.full_name ?? undefined,
      sender_name: me?.full_name ?? undefined,
    });

    const { sendComposed } = await import("@/lib/email/dispatch.server");
    const result = await sendComposed({
      to: applicant.email,
      toName: ctx.full_name || null,
      subject: data.subject,
      message: data.message,
      applicantId: applicant.id,
      sentBy: userId,
      replyTo: me?.email ?? undefined,
      context: ctx,
    });
    if (result.status === "failed") throw new Error(result.error);
    return result;
  });

/* ============================================================ */
/* Campaigns + preferences                                       */
/* ============================================================ */

export const listEmailCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [campaigns, subs] = await Promise.all([
      supabase.from("email_campaigns").select("*").order("name"),
      supabase
        .from("email_campaign_subscriptions")
        .select("campaign_slug, subscribed")
        .eq("user_id", userId),
    ]);
    const map = new Map((subs.data ?? []).map((s: any) => [s.campaign_slug, s.subscribed]));
    return (campaigns.data ?? []).map((c: any) => ({
      ...c,
      subscribed: map.get(c.slug) ?? true,
    }));
  });

export const saveEmailCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        enabled: z.boolean().optional(),
        schedule_label: z.string().max(120).optional(),
        content: z.record(z.string(), z.string()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.enabled !== undefined) patch["enabled"] = data.enabled;
    if (data.schedule_label !== undefined) patch["schedule_label"] = data.schedule_label;
    if (data.content !== undefined) patch["content"] = data.content;
    const { error } = await supabase
      .from("email_campaigns")
      .update(patch as never)
      .eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCampaignSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1), subscribed: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("email_campaign_subscriptions").upsert(
      {
        user_id: userId,
        campaign_slug: data.slug,
        subscribed: data.subscribed,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,campaign_slug" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
