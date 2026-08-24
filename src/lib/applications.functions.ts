import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { queueEmail, sendAgentNewApplicant } from "@/lib/emails/send";
import { scheduleLabel } from "@/lib/recruit-alert";

function serverClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const applicationSchema = z
  .object({
    first_name: z.string().trim().min(1).max(80),
    last_name: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().min(7).max(40),
    state: z.string().trim().length(2),
    licensed: z.boolean(),
    instagram_handle: z.string().trim().max(80).optional().or(z.literal("")),
    why_text: z.string().trim().min(10).max(2000),
    consent_contact: z.literal(true),
    // Attribution — either an existing recruiter uuid OR a typed name.
    referred_by_profile_id: z.string().uuid().optional().or(z.literal("")),
    referred_by_name: z.string().trim().max(160).optional().or(z.literal("")),
    original_referral_profile_id: z.string().uuid().optional().or(z.literal("")),
    referral_slug: z.string().trim().max(120).optional().or(z.literal("")),
    referral_source: z.enum(["referral_link", "manual", "direct"]).optional(),
    referral_landing_url: z.string().trim().max(600).optional().or(z.literal("")),
    invalid_referral_slug: z.string().trim().max(120).optional().or(z.literal("")),
    // Monday overview slot the applicant picked on the form (ISO-8601 UTC).
    requested_overview_at: z.string().trim().max(40).optional().or(z.literal("")),

  })
  .refine(
    (d) =>
      (typeof d.referred_by_profile_id === "string" && d.referred_by_profile_id.length > 0) ||
      (typeof d.referred_by_name === "string" && d.referred_by_name.length > 0),
    { message: "Provide a recruiter", path: ["referred_by_profile_id"] },
  );

export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => applicationSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: result, error } = await supabase.rpc("submit_application", {
      payload: data as never,
    });
    if (error) throw new Error(error.message);
    const res = result as {
      id: string;
      token: string;
      success_page_type: "licensed" | "unlicensed";
      recruiter_id: string | null;
    };

    // Persist the overview slot they picked on the form so the pipeline shows an
    // intended date even before Calendly confirms it. "none" means they couldn't
    // attend any date and want a 1:1 call instead. Never blocks submission.
    if (data.requested_overview_at) {
      const { error: slotError } = await (supabase as any).rpc("set_requested_overview", {
        _token: res.token,
        _at: data.requested_overview_at === "none" ? null : data.requested_overview_at,
      });
      if (slotError) console.error("set_requested_overview failed", slotError.message);
    }

    // Recruiter + applicant details for the agent alert, the agent's copy of the
    // applicant email, and the Discord recruiting bot. Token-gated RPC — never
    // blocks the submission.
    type NotifyContext = {
      found: boolean;
      applicant_id?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      state?: string;
      licensed?: boolean;
      instagram_handle?: string;
      why_text?: string;
      requested_overview_at?: string | null;
      wants_one_on_one?: boolean;
      referred_by_name?: string | null;
      recruiter_id?: string | null;
      recruiter_name?: string | null;
      recruiter_email?: string | null;
    };
    let ctx: NotifyContext = { found: false };
    try {
      const { data: raw } = await (supabase as any).rpc("get_applicant_notify_context", {
        _token: res.token,
      });
      if (raw && typeof raw === "object") ctx = raw as NotifyContext;
    } catch (e) {
      console.error("get_applicant_notify_context failed", e);
    }

    const applicantName = `${data.first_name} ${data.last_name}`.trim();
    const recruiterName = ctx.recruiter_name?.trim() || ctx.referred_by_name?.trim() || data.referred_by_name || null;

    // Trigger: application-submitted email (branches on licensing), with the
    // recruiting agent copied so they see exactly what their applicant got.
    await queueEmail(supabase as never, {
      to: data.email,
      toName: applicantName,
      applicantId: res.id,
      template: res.success_page_type === "licensed" ? "application_licensed" : "application_unlicensed",
      params: { firstName: data.first_name, licensed: res.success_page_type === "licensed" },
      copyTo: ctx.recruiter_email
        ? { email: ctx.recruiter_email, name: ctx.recruiter_name }
        : null,
      copyForName: applicantName,
    });

    // Trigger: "you have a new applicant" alert to the recruiting agent.
    const scheduled = scheduleLabel({
      requestedOverviewAt: ctx.requested_overview_at ?? null,
      wantsOneOnOne: !!ctx.wants_one_on_one,
    });
    if (ctx.recruiter_email) {
      await sendAgentNewApplicant(supabase as never, {
        agentEmail: ctx.recruiter_email,
        agentName: ctx.recruiter_name,
        applicantId: res.id,
        applicantName,
        applicantEmail: data.email,
        applicantPhone: data.phone,
        state: data.state,
        licensed: res.success_page_type === "licensed",
        instagramHandle: data.instagram_handle || undefined,
        whyText: data.why_text,
        scheduleLabel: scheduled,
        referredByName: recruiterName ?? undefined,
        applicantUrl: `${(process.env.VANTAGE_APP_URL || "https://vantage-financial.net").replace(/\/$/, "")}/portal/crm/${res.id}`,
      });
    }

    // Trigger: Discord recruiting bot. No-ops when no webhook is configured.
    // Server-only module — loaded inside the handler so it never ships to the client.
    const { notifyNewRecruit } = await import("@/lib/discord.server");
    const discord = await notifyNewRecruit({
      firstName: data.first_name,
      lastName: data.last_name,
      recruiterName,
      licensed: res.success_page_type === "licensed",
      requestedOverviewAt: ctx.requested_overview_at ?? null,
      wantsOneOnOne: !!ctx.wants_one_on_one,
      state: data.state,
    });
    // Record the outcome on the applicant timeline so a silent Discord failure
    // is visible in the CRM instead of vanishing into server logs.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).from("applicant_activities").insert({
        applicant_id: res.id,
        event_type: "discord_alert",
        summary: discord.ok
          ? "Discord recruiting alert posted"
          : discord.reason === "no_webhook"
            ? "Discord alert skipped — no webhook configured"
            : "Discord alert rejected by Discord",
        data: { ok: discord.ok, reason: discord.reason ?? null },
      });
    } catch (e) {
      console.error("discord activity log failed", e);
    }


    return res;
  });



const evaluationSchema = z.object({
  applicant_id: z.string().uuid().optional().or(z.literal("")),
  email: z.string().trim().email().max(200),
  answers: z.record(z.string(), z.string()).default({}),
});

export const submitEvaluation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => evaluationSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: result, error } = await supabase.rpc("submit_evaluation", {
      payload: data as never,
    });
    if (error) throw new Error(error.message);
    const res = result as { id: string; matched: boolean; hired: boolean; licensed: boolean };

    // Trigger: conditional hire. Route through the stage engine so the record,
    // timeline, sequences, and the Selected email (with the single-use
    // "I've purchased my course" link) all stay in sync.
    if (res.hired) {
      try {
        const engine = await import("@/lib/recruiting/stage-engine.server");
        const applicant =
          (data.applicant_id ? await engine.loadApplicant(data.applicant_id) : null) ??
          (await engine.findApplicant(data.email));
        if (applicant) {
          await engine.logActivity(
            applicant.id,
            "evaluation_completed",
            "Evaluation Completed",
            { evaluation_id: res.id },
          );
          await engine.stopSequence(applicant.id, "interview_reminders", "evaluation_completed");
          await engine.applyStage({
            applicantId: applicant.id,
            stage: "interview-completed",
            reason: "evaluation_completed",
            patch: { evaluation_completed_at: new Date().toISOString() },
            sendKey: `hired:${applicant.id}`,
          });
          await engine.logActivity(applicant.id, "hired", "Conditionally Hired", {});
        }
      } catch (e) {
        console.error("evaluation hire automation failed", e);
      }
    }

    return res;
  });

export type EvaluationPrefill = {
  found: boolean;
  first_name?: string;
  last_name?: string;
  email?: string;
  licensed?: boolean;
  licensing_status?: string | null;
  already_hired?: boolean;
};

/** Resolve prefill fields for the evaluation form from an applicant UUID link. */
export const getEvaluationPrefill = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ applicant_id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    // Generated types lag the new RPC — cast until types are regenerated.
    const { data: result, error } = await (supabase as any).rpc("get_evaluation_prefill", {
      _applicant_id: data.applicant_id,
    });
    if (error) throw new Error(error.message);
    return (result ?? { found: false }) as EvaluationPrefill;
  });

export type RecruiterOption = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  recruiting_slug: string | null;
  team_name: string | null;
};

// Safe, debounced recruiter directory search for the public application form.
// Backed by the SECURITY DEFINER search_recruiters RPC (active + recruiting
// agents only, no PII). Never exposes the profiles table to the public.
export const searchRecruiters = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ q: z.string().trim().max(80).optional().or(z.literal("")) }).parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: rows, error } = await supabase.rpc("search_recruiters", { _q: data.q ?? "" });
    if (error) throw new Error(error.message);
    return (rows ?? []) as RecruiterOption[];
  });

// Resolve a single active recruiter from a referral slug (for link preselect).
export const getRecruiterBySlug = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(120) }).parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: rows, error } = await supabase.rpc("get_recruiter_by_slug", { _slug: data.slug });
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0];
    return (row ?? null) as RecruiterOption | null;
  });

type SchedulingContext = {
  found: boolean;
  first_name?: string;
  success_page_type?: "licensed" | "unlicensed";
  calendly_url?: string | null;
  contact_name?: string | null;
  contact_kind?: string | null;
  link_missing?: boolean;
  scheduling_status?: string;
};

export const getSchedulingContext = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(10).max(128) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: result, error } = await supabase.rpc("resolve_scheduling_context", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    return (result ?? { found: false }) as SchedulingContext;
  });

export const markLicensedFallback = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(10).max(128) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: result, error } = await supabase.rpc("mark_licensed_fallback", { _token: data.token });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; already?: boolean };
  });

export const markScheduled = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(10).max(128) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: result, error } = await supabase.rpc("mark_scheduled_by_token", { _token: data.token });
    if (error) throw new Error(error.message);
    return result as { matched: boolean; id?: string };
  });


export type OverviewBooking = {
  found: boolean;
  /** Calendly URL, deep-linked to the chosen slot and pre-filled when possible. */
  url: string | null;
  requested_overview_at: string | null;
  /** True when the applicant said none of the overview dates worked. */
  wants_one_on_one: boolean;
  /** Nearest leader's 1:1 Calendly link, pre-filled. */
  one_on_one_url: string | null;
};

/**
 * Resolve the one-tap Calendly confirm URL for an applicant's chosen overview
 * slot. Calendly does not allow third parties to create a booking on an
 * invitee's behalf, so the applicant confirms on Calendly — pre-filled.
 */
export const getOverviewBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(10).max(128), base_url: z.string().max(600).default("") }).parse(data),
  )
  .handler(async ({ data }) => {
    const { buildPrefilledUrl } = await import("@/lib/calendly.server");
    const supabase = serverClient();
    const { data: result, error } = await (supabase as any).rpc("get_overview_prefill", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    const row = (result ?? { found: false }) as {
      found: boolean;
      requested_overview_at?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      phone?: string | null;
      referrer_name?: string | null;
      wants_one_on_one?: boolean | null;
      one_on_one_url?: string | null;
    };
    if (!row.found)
      return {
        found: false,
        url: null,
        requested_overview_at: null,
        wants_one_on_one: false,
        one_on_one_url: null,
      } as OverviewBooking;
    const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
    const prefill = {
      name,
      email: row.email ?? null,
      token: data.token,
      phone: row.phone ?? null,
      referrerName: row.referrer_name ?? null,
    };
    return {
      found: true,
      requested_overview_at: row.requested_overview_at ?? null,
      wants_one_on_one: Boolean(row.wants_one_on_one),
      url: data.base_url
        ? buildPrefilledUrl(data.base_url, row.requested_overview_at ?? null, prefill, "overview")
        : null,
      one_on_one_url: row.one_on_one_url
        ? buildPrefilledUrl(row.one_on_one_url, null, prefill, "one_on_one")
        : null,
    } as OverviewBooking;
  });
