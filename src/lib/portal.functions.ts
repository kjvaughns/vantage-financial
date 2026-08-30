import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { queueEmail, firstNameFrom } from "@/lib/emails/send";
import { ONBOARDING_STEP_ORDER } from "@/lib/onboarding";
import { RECRUITING_STATUSES } from "@/lib/recruiting";

const APP_URL = () =>
  (process.env.VANTAGE_APP_URL || "https://vantage-financial.net").replace(/\/$/, "");

type OnboardingApplicant = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  portal_profile_id?: string | null;
};

/** Resolve the account destination for an onboarding welcome email. Existing
 *  agents go to onboarding; new agents always receive a one-time registration
 *  link with their applicant details prefilled. */
async function resolveOnboardingPortalLink(
  supabase: any,
  a: OnboardingApplicant,
): Promise<string> {
  if (a.portal_profile_id) return `${APP_URL()}/portal/onboarding`;
  if (!a.email) throw new Error("Applicant has no email address.");
  const { data: res, error } = await supabase.rpc("ensure_onboarding_invitation", {
    _applicant_id: a.id,
  });
  if (error) throw new Error(error.message);
  const token = res?.token as string | undefined;
  if (!res?.ok || !token) throw new Error("Could not create an onboarding registration link.");
  return `${APP_URL()}/portal-invite/${token}`;
}

/** Resolve the recruiting agent who should be copied on an applicant's email.
 *  Returns null when the applicant has no recruiter or the recruiter has no
 *  email on file. Best-effort — never throws. */
async function recruiterCopy(
  supabase: any,
  applicantId?: string | null,
): Promise<{ email: string; name: string | null } | null> {
  if (!applicantId) return null;
  try {
    const { data } = await supabase.rpc("get_recruiter_for_applicant", {
      _applicant_id: applicantId,
    });
    const r = data as { found?: boolean; recruiter_email?: string; recruiter_name?: string } | null;
    if (!r?.found || !r.recruiter_email) return null;
    return { email: r.recruiter_email, name: r.recruiter_name ?? null };
  } catch {
    return null;
  }
}

/** Enqueue the "Welcome to Onboarding" email (best-effort, never throws). The
 *  onboarding_steps checklist on the Onboarding page is the source of truth. */
async function enqueueWelcomeOnboarding(supabase: any, a: OnboardingApplicant): Promise<void> {
  if (!a.email) return;
  const portalLink = await resolveOnboardingPortalLink(supabase, a);
  const applicantName = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || undefined;
  await queueEmail(supabase, {
    to: a.email,
    toName: applicantName,
    applicantId: a.id,
    template: "welcome_onboarding",
    params: { firstName: firstNameFrom(null, a.first_name), portalLink },
    copyTo: await recruiterCopy(supabase, a.id),
    copyForName: applicantName ?? a.email,
  });
}

/** Current user profile + roles + team. */
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roles = (rolesRes.data ?? []).map((r) => r.role as string);
    const ORDER = ["super_admin", "admin", "manager", "leader", "agent"];
    const primaryRole = ORDER.find((r) => roles.includes(r)) ?? null;
    return {
      profile: profileRes.data,
      roles,
      primaryRole,
    };
  });

// Precedence-ordered role labels shown in the portal (owner level hidden).
export const PORTAL_ROLES = ["admin", "manager", "leader", "agent"] as const;
export type PortalRole = (typeof PORTAL_ROLES)[number];

/** The signed-in agent's recruiting slug + how many applicants it generated. */
export const getMyRecruitingLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("recruiting_slug, is_active, can_receive_applicants")
      .eq("id", userId)
      .maybeSingle();
    const { count } = await supabase
      .from("applicants")
      .select("id", { count: "exact", head: true })
      .eq("referred_by_profile_id", userId);
    return {
      recruiting_slug: prof?.recruiting_slug ?? null,
      is_active: prof?.is_active ?? false,
      can_receive_applicants: prof?.can_receive_applicants ?? false,
      applicant_count: count ?? 0,
    };
  });

/** Managers/admins: recruiting links of active agents on their team. */
export const getTeamRecruitingLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const roles = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roleList = (roles.data ?? []).map((r) => r.role as string);
    const isManager = roleList.some((r) => r === "manager" || r === "admin" || r === "super_admin");
    if (!isManager) return { agents: [] as TeamRecruitingLink[] };
    const { data: me } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", userId)
      .maybeSingle();
    if (!me?.team_id) return { agents: [] as TeamRecruitingLink[] };
    const { data: agents } = await supabase
      .from("profiles")
      .select("id, full_name, recruiting_slug, can_receive_applicants")
      .eq("team_id", me.team_id)
      .eq("is_active", true)
      .order("full_name");
    return { agents: (agents ?? []) as TeamRecruitingLink[] };
  });

type TeamRecruitingLink = {
  id: string;
  full_name: string | null;
  recruiting_slug: string | null;
  can_receive_applicants: boolean;
};

/** Dashboard KPIs + activity feed for the signed-in user. */
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
    const since7 = new Date(Date.now() - 7 * 86400_000).toISOString();

    const [mineRes, mine7Res, scheduledRes, evalDoneRes, feedRes, stagesRes, followUpRes] =
      await Promise.all([
      supabase
        .from("applicants")
        .select("id, current_stage_id, status", { count: "exact" })
        .eq("assigned_recruiter_id", userId)
        .is("archived_at", null),
      supabase
        .from("applicants")
        .select("id", { count: "exact", head: true })
        .eq("assigned_recruiter_id", userId)
        .gte("created_at", since7),
      supabase
        .from("applicants")
        .select("id", { count: "exact", head: true })
        .eq("assigned_recruiter_id", userId)
        .not("calendly_scheduled_at", "is", null)
        .gte("calendly_scheduled_at", since30),
      supabase
        .from("applicants")
        .select("id", { count: "exact", head: true })
        .eq("assigned_recruiter_id", userId)
        .not("evaluation_completed_at", "is", null)
        .gte("evaluation_completed_at", since30),
      supabase
        .from("applicant_activities")
        .select(
          "id, event_type, summary, created_at, applicant_id, applicants(first_name, last_name, assigned_recruiter_id)",
        )
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("pipeline_stages")
        .select("id, name, slug, color, position")
        .eq("is_archived", false)
        .order("position"),
      // Pre-licensing hires overdue for a weekly follow-up (>7d since last, or
      // never). Scoped to the signed-in user's own applicants. Cast: generated
      // types lag the hired_at / last_follow_up_at columns.
      (supabase as any)
        .from("applicants")
        .select("id, first_name, last_name, hired_at, last_follow_up_at")
        .eq("assigned_recruiter_id", userId)
        .eq("licensed", false)
        .not("hired_at", "is", null)
        .is("archived_at", null)
        .or(`last_follow_up_at.is.null,last_follow_up_at.lt.${since7}`)
        .order("last_follow_up_at", { ascending: true, nullsFirst: true })
        .limit(50),
    ]);

    const stages = stagesRes.data ?? [];
    const stageCounts: Record<string, number> = {};
    for (const a of mineRes.data ?? []) {
      if (a.current_stage_id)
        stageCounts[a.current_stage_id] = (stageCounts[a.current_stage_id] ?? 0) + 1;
    }

    return {
      counts: {
        totalMine: mineRes.count ?? 0,
        newThisWeek: mine7Res.count ?? 0,
        scheduled30d: scheduledRes.count ?? 0,
        evaluated30d: evalDoneRes.count ?? 0,
      },
      stages,
      stageCounts,
      needsFollowUp: (followUpRes.data ?? []) as {
        id: string;
        first_name: string;
        last_name: string;
        hired_at: string | null;
        last_follow_up_at: string | null;
      }[],
      feed: (feedRes.data ?? []).filter((f) => {
        // Show items for own applicants; managers/admins see all via RLS
        const rec = (f.applicants as { assigned_recruiter_id: string | null } | null)
          ?.assigned_recruiter_id;
        return !rec || rec === userId || true;
      }),
    };
  });

const listInput = z.object({
  q: z.string().optional().default(""),
  stage: z.string().optional().default(""),
  scope: z.enum(["mine", "direct", "downline", "all"]).optional().default("mine"),
  view: z.enum(["all", "pre_licensing"]).optional().default("all"),
  limit: z.number().int().min(1).max(200).optional().default(100),
});

export const listApplicants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInput.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let query = supabase
      .from("applicants")
      .select(
        "id, first_name, last_name, email, phone, instagram_handle, state, city, priority, status, current_stage_id, assigned_recruiter_id, referred_by_profile_id, original_recruiter_id, licensing_status, evaluation_completed_at, calendly_scheduled_at, overview_scheduled_at, overview_completed_at, licensed, hired_at, discord_confirmed, last_contacted_at, last_follow_up_at, onboarding_steps, created_at, updated_at, stage_entered_at",
      )
      .is("archived_at", null)
      .limit(data.limit);

    // Pre-Licensing Pipeline: hired-but-unlicensed, oldest follow-up first so the
    // most overdue check-ins float to the top. Otherwise newest applicants first.
    if (data.view === "pre_licensing") {
      query = query
        .eq("licensed", false)
        .not("hired_at", "is", null)
        .order("last_follow_up_at", { ascending: true, nullsFirst: true });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    // Scope: mine = own only; direct = self + direct reports; downline/all rely
    // on hierarchy RLS (own + full downline; admins see everything).
    if (data.scope === "mine") {
      query = query.eq("assigned_recruiter_id", userId);
    } else if (data.scope === "direct") {
      const { data: reports } = await supabase
        .from("profiles")
        .select("id")
        .eq("parent_user_id", userId);
      const ids = [userId, ...((reports ?? []) as { id: string }[]).map((r) => r.id)];
      query = query.in("assigned_recruiter_id", ids);
    }
    if (data.stage) query = query.eq("current_stage_id", data.stage);
    if (data.q.trim()) {
      const q = data.q.trim();
      query = query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
      );
    }

    const [aRes, stagesRes] = await Promise.all([
      query,
      supabase
        .from("pipeline_stages")
        .select("id, name, slug, color, position")
        .eq("is_archived", false)
        .order("position"),
    ]);

    // Resolve referring-recruiter display names in one pass.
    const applicants = (aRes.data ?? []) as any[];
    const recruiterIds = Array.from(
      new Set(
        applicants
          .map((a) => a.referred_by_profile_id || a.original_recruiter_id || a.assigned_recruiter_id)
          .filter(Boolean),
      ),
    ) as string[];
    let nameById: Record<string, string> = {};
    if (recruiterIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", recruiterIds);
      for (const p of (profs ?? []) as any[]) {
        nameById[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "";
      }
    }
    const withRecruiter = applicants.map((a) => ({
      ...a,
      referring_recruiter_name:
        nameById[a.referred_by_profile_id || a.original_recruiter_id || a.assigned_recruiter_id] ||
        ((a as any).referred_by_name_snapshot as string | null) ||
        (a.referred_by_profile_id || a.original_recruiter_id || a.assigned_recruiter_id
          ? null
          : "Company lead — unassigned"),
    }));

    return { applicants: withRecruiter, stages: stagesRes.data ?? [] };
  });

export const getApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [aRes, actsRes, evalRes, stagesRes] = await Promise.all([
      supabase.from("applicants").select("*").eq("id", data.id).maybeSingle(),
      supabase
        .from("applicant_activities")
        .select("id, event_type, summary, created_at, data")
        .eq("applicant_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("evaluations")
        .select("id, email, answers, matched, score, created_at")
        .eq("applicant_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("pipeline_stages")
        .select("id, name, slug, color, position")
        .eq("is_archived", false)
        .order("position"),
    ]);
    if (!aRes.data) throw new Error("Applicant not found");
    const app = aRes.data as any;
    const recruiterId =
      app.referred_by_profile_id || app.original_recruiter_id || app.assigned_recruiter_id;
    let referringRecruiterName: string | null =
      (app.referred_by_name_snapshot as string | null) ?? null;
    if (recruiterId) {
      const { data: rec } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", recruiterId)
        .maybeSingle();
      if (rec) {
        referringRecruiterName =
          [rec.first_name, rec.last_name].filter(Boolean).join(" ") || referringRecruiterName;
      }
    }
    return {
      applicant: app,
      referringRecruiterName,
      activities: actsRes.data ?? [],
      evaluations: evalRes.data ?? [],
      stages: stagesRes.data ?? [],
    };
  });

type OnboardingResult = {
  found: boolean;
  applicant_id?: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  steps?: Record<string, { completed: boolean; completed_at: string | null }>;
  done?: number;
  total?: number;
  complete?: boolean;
  just_completed?: boolean;
};

/** After the RPC updates steps, send the completion email once (best-effort). */
async function afterOnboardingUpdate(supabase: any, res: OnboardingResult) {
  // Final requirement checked ⇒ onboarding complete, agent moves to Training.
  if (res.just_completed && res.applicant_id) {
    try {
      const engine = await import("@/lib/recruiting/stage-engine.server");
      await engine.logActivity(res.applicant_id, "onboarding_completed", "Onboarding Completed");
      await engine.applyStage({
        applicantId: res.applicant_id,
        stage: "training",
        reason: "onboarding_completed",
        sendKey: `training:${res.applicant_id}`,
      });
      await engine.logActivity(res.applicant_id, "training_started", "Training Started");
    } catch (e) {
      console.error("training handoff failed", e);
    }
  }
  if (res.just_completed && res.email) {
    const applicantName = `${res.first_name ?? ""} ${res.last_name ?? ""}`.trim() || undefined;
    await queueEmail(supabase, {
      to: res.email,
      toName: applicantName,
      applicantId: res.applicant_id ?? null,
      template: "onboarding_complete",
      params: { firstName: firstNameFrom(null, res.first_name) },
      copyTo: await recruiterCopy(supabase, res.applicant_id ?? null),
      copyForName: applicantName ?? res.email,
    });
  }
}


/** The signed-in agent's onboarding state (recomputed on each view; fires the
 *  completion email once all steps are done). Non-agents resolve to
 *  { hasOnboarding:false }. */
export const getMyOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // Empty step: just fetch/recompute state (account setup is no longer a step).
    const { data, error } = await (supabase as any).rpc("update_onboarding", {
      _step: "",
    });
    if (error) throw new Error(error.message);
    const res = (data ?? { found: false }) as OnboardingResult;
    if (!res.found) return { hasOnboarding: false as const };
    await afterOnboardingUpdate(supabase, res);
    return {
      hasOnboarding: true as const,
      steps: res.steps ?? {},
      done: res.done ?? 0,
      total: res.total ?? ONBOARDING_STEP_ORDER.length,
      complete: !!res.complete,
    };
  });

/** Agent self-checks one of the manual onboarding steps. */
export const completeOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        step: z.enum([
          "agent_cloud_onboarding",
          "discord_role_update",
          "read_agent_playbook",
          "agent_expectations_schedule",
          "complete_vantage_closer_course",
        ]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: res, error } = await (supabase as any).rpc("update_onboarding", {
      _step: data.step,
    });
    if (error) throw new Error(error.message);
    const r = (res ?? { found: false }) as OnboardingResult;
    if (!r.found) throw new Error("No onboarding record found for your account.");
    await afterOnboardingUpdate(supabase, r);
    return {
      steps: r.steps ?? {},
      done: r.done ?? 0,
      total: r.total ?? ONBOARDING_STEP_ORDER.length,
      complete: !!r.complete,
    };
  });

/** Onboarding notifications the agent triggers from their checklist: reaching
 *  pending contracting (notify leadership) and completion (notify trainer).
 *  Logs an activity on the agent's applicant record and emails their recruiter
 *  (best-effort). */
export const notifyOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ kind: z.enum(["contracting_done", "trainer"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: app } = await supabase
      .from("applicants")
      .select("id, first_name, last_name, email")
      .eq("portal_profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!app) return { ok: false as const };

    const name = `${app.first_name ?? ""} ${app.last_name ?? ""}`.trim() || "An agent";
    const isContracting = data.kind === "contracting_done";
    const summary = isContracting
      ? "Created their Agent Cloud account (agent-reported)"
      : "Onboarding complete — trainer notified";

    await supabase.from("applicant_activities").insert({
      applicant_id: app.id,
      event_type: isContracting ? "contracting_reported" : "trainer_notified",
      summary,
      actor_id: userId,
    } as never);

    const copy = await recruiterCopy(supabase, app.id);
    if (copy?.email) {
      try {
        const { sendRawEmail } = await import("@/lib/email-templates/send-email");
        const subject = isContracting
          ? `${name} created their Agent Cloud account`
          : `${name} completed onboarding`;
        const line = isContracting
          ? `${name} has completed Agent Cloud onboarding.`
          : `${name} has completed onboarding and is ready for New Agent Live Training.`;
        await sendRawEmail(
          copy.email,
          subject,
          `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#111">${line}</div>`,
          { idempotencyKey: `onb-${data.kind}-${app.id}` },
        );
      } catch {
        /* best-effort */
      }
    }
    return { ok: true as const };
  });

export const updateApplicantStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), stage_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("slug")
      .eq("id", data.stage_id)
      .maybeSingle();
    const slug = stage?.slug as string | undefined;
    if (!slug) throw new Error("Unknown stage");

    // Onboarding is a handoff — the stage engine mints the account-setup
    // invitation and points the onboarding email at it.
    const engine = await import("@/lib/recruiting/stage-engine.server");
    const res = await engine.applyStage({
      applicantId: data.id,
      stage: slug as never,
      actorId: userId,
      reason: "manual",
    });

    if (!res.ok) throw new Error("Could not update the stage");
    return { ok: true };
  });

/** Manually flip the Overview meeting scheduled/completed flags (Phase 1).
 *  Used when a recruiter books the overview outside Calendly. Setting
 *  "completed" also stamps "scheduled" if it wasn't already. */
export const setOverviewStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        field: z.enum(["scheduled", "completed"]),
        value: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: now };

    if (data.field === "scheduled") {
      patch.overview_scheduled_at = data.value ? now : null;
      // Un-scheduling clears completion too — can't be completed if not scheduled.
      if (!data.value) patch.overview_completed_at = null;
    } else {
      patch.overview_completed_at = data.value ? now : null;
      // Completing implies it was scheduled.
      if (data.value) {
        const { data: cur } = await supabase
          .from("applicants")
          .select("overview_scheduled_at")
          .eq("id", data.id)
          .maybeSingle();
        if (!(cur as { overview_scheduled_at?: string } | null)?.overview_scheduled_at) {
          patch.overview_scheduled_at = now;
        }
      }
    }

    const { error } = await supabase
      .from("applicants")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const label =
      data.field === "scheduled"
        ? data.value
          ? "Overview marked scheduled"
          : "Overview scheduled flag cleared"
        : data.value
          ? "Overview marked completed"
          : "Overview completed flag cleared";
    await supabase.from("applicant_activities").insert({
      applicant_id: data.id,
      event_type: "overview_updated",
      summary: label,
      actor_id: userId,
    } as never);
    return { ok: true };
  });

/** Manual pre-licensing follow-up nudge (Email 4). Enqueues the follow-up
 *  template, logs the activity, and stamps last-contact. Phase 5 also resets
 *  the follow-up counter here. */
export const sendFollowUpEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: a } = await supabase
      .from("applicants")
      .select("id, first_name, last_name, email")
      .eq("id", data.id)
      .maybeSingle();
    if (!a?.email) throw new Error("Applicant has no email on file.");

    const applicantName = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || undefined;
    await queueEmail(supabase as never, {
      to: a.email,
      toName: applicantName,
      applicantId: a.id,
      template: "followup_checkin",
      params: { firstName: firstNameFrom(null, a.first_name) },
      copyTo: await recruiterCopy(supabase, a.id),
      copyForName: applicantName ?? a.email,
    });


    const now = new Date().toISOString();
    // last_follow_up_at resets the weekly-follow-up counter (Phase 5).
    await supabase
      .from("applicants")
      .update({ last_contacted_at: now, last_follow_up_at: now, updated_at: now } as never)
      .eq("id", data.id);
    await supabase.from("applicant_activities").insert({
      applicant_id: data.id,
      event_type: "follow_up_sent",
      summary: "Follow-up email sent",
      actor_id: userId,
    } as never);
    return { ok: true };
  });

/** Manual "Discord confirmed" flag for unlicensed hires (Phase 4). */
export const setDiscordConfirmed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), value: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("applicants")
      .update({ discord_confirmed: data.value, updated_at: new Date().toISOString() } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("applicant_activities").insert({
      applicant_id: data.id,
      event_type: "discord_updated",
      summary: data.value ? "Discord course post confirmed" : "Discord confirmation cleared",
      actor_id: userId,
    } as never);
    return { ok: true };
  });

export const addApplicantNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().trim().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await supabase.from("applicant_activities").insert({
      applicant_id: data.id,
      event_type: "note",
      summary: data.note,
      actor_id: userId,
    });
    await supabase
      .from("applicants")
      .update({ last_contacted_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

/** Inline-edit an applicant's CRM fields (everything except stage, which goes
 *  through updateApplicantStage so its onboarding automation runs). Only the
 *  provided fields are written; a summary of what changed is logged. */
export const updateApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        first_name: z.string().trim().max(120).optional(),
        last_name: z.string().trim().max(120).optional(),
        email: z.string().trim().email().max(200).optional(),
        phone: z.string().trim().max(40).nullable().optional(),
        city: z.string().trim().max(120).nullable().optional(),
        state: z.string().trim().max(60).nullable().optional(),
        resident_state: z.string().trim().max(60).nullable().optional(),
        npn: z.string().trim().max(40).nullable().optional(),
        licensing_status: z.string().trim().max(60).nullable().optional(),
        recruiting_status: z.enum(RECRUITING_STATUSES).optional(),
        assigned_recruiter_id: z.string().uuid().nullable().optional(),
        referred_by_profile_id: z.string().uuid().nullable().optional(),
        next_follow_up_at: z.string().datetime().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v;
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    patch.updated_at = new Date().toISOString();

    // The recruiter shown on the record resolves from referred_by_profile_id
    // first, then falls back to the free-text snapshot captured at apply time.
    // When someone corrects the referring recruiter, refresh (or clear) that
    // snapshot so the stale typed-in name stops winning the display.
    if (data.referred_by_profile_id !== undefined) {
      if (data.referred_by_profile_id) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: rec } = await supabaseAdmin
          .from("profiles")
          .select("first_name, last_name, full_name")
          .eq("id", data.referred_by_profile_id)
          .maybeSingle();
        const name =
          [rec?.first_name, rec?.last_name].filter(Boolean).join(" ") || rec?.full_name || null;
        patch.referred_by_name_snapshot = name;
        patch.referred_by_name = name;
      } else {
        patch.referred_by_name_snapshot = null;
        patch.referred_by_name = null;
      }
    }


    const { error } = await supabase.from("applicants").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);

    // Status side effects: No Show / Follow Up start the capped follow-up
    // series; a closed-out status stops every active sequence.
    if (data.recruiting_status) {
      try {
        const engine = await import("@/lib/recruiting/stage-engine.server");
        if (data.recruiting_status === "no_show" || data.recruiting_status === "follow_up") {
          await engine.startSequence(id, "no_show_followup", new Date().toISOString());
          await engine.logActivity(
            id,
            data.recruiting_status === "no_show" ? "no_show" : "follow_up_started",
            data.recruiting_status === "no_show" ? "Marked No Show — follow up started" : "Follow up started",
            {},
            userId,
          );
        } else if (
          ["not_interested", "not_qualified", "declined", "terminated", "inactive"].includes(
            data.recruiting_status,
          )
        ) {
          await engine.stopAllSequences(id, `status:${data.recruiting_status}`);
        }
      } catch (e) {
        console.error("status automation failed", e);
      }
    }

    const changed = Object.keys(patch).filter((k) => k !== "updated_at");
    await supabase.from("applicant_activities").insert({
      applicant_id: id,
      event_type: "record_updated",
      summary: `Updated ${changed.join(", ")}`,
      actor_id: userId,
      data: { fields: changed },
    } as never);
    return { ok: true };
  });

// Manual activity types an authorized user can log from the applicant record.
const MANUAL_ACTIVITY_TYPES = [
  "called",
  "no_answer",
  "left_voicemail",
  "text_sent",
  "email_sent",
  "spoke_with",
  "interview_scheduled",
  "interview_completed",
  "follow_up_scheduled",
  "evaluation_completed",
  "licensing_update",
  "onboarding_started",
  "training_started",
  "hired",
  "terminated",
  "other",
] as const;
// Types that count as making contact (bump last_contacted_at).
const CONTACT_ACTIVITY_TYPES = new Set([
  "called",
  "left_voicemail",
  "text_sent",
  "email_sent",
  "spoke_with",
]);

/** Log a manual activity on an applicant's timeline. Optionally schedules a
 *  follow-up (writes next_follow_up_at). Stores type/notes/time/actor. */
export const logApplicantActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        type: z.enum(MANUAL_ACTIVITY_TYPES),
        summary: z.string().trim().max(400).optional(),
        notes: z.string().trim().max(2000).optional(),
        occurred_at: z.string().datetime().optional(),
        follow_up_at: z.string().datetime().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const when = data.occurred_at ?? new Date().toISOString();
    const summary =
      (data.summary && data.summary.trim()) ||
      (data.notes && data.notes.trim()) ||
      data.type.replace(/_/g, " ");

    await supabase.from("applicant_activities").insert({
      applicant_id: data.id,
      event_type: data.type,
      summary,
      actor_id: userId,
      created_at: when,
      data: { notes: data.notes ?? null, follow_up_at: data.follow_up_at ?? null },
    } as never);

    const patch: Record<string, unknown> = {};
    if (data.follow_up_at) patch.next_follow_up_at = data.follow_up_at;
    if (CONTACT_ACTIVITY_TYPES.has(data.type)) patch.last_contacted_at = when;
    if (Object.keys(patch).length) {
      patch.updated_at = new Date().toISOString();
      await supabase.from("applicants").update(patch as never).eq("id", data.id);
    }
    return { ok: true };
  });

/** Send a recruiter-composed email to an applicant (free-form subject/body from
 *  the Send Email composer). Delivers best-effort, logs to the outbox, and adds
 *  an email_sent activity to the timeline. */
export const sendApplicantEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        subject: z.string().trim().min(1).max(300),
        body: z.string().trim().min(1).max(20000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: a } = await supabase
      .from("applicants")
      .select("id, email, first_name, last_name")
      .eq("id", data.id)
      .maybeSingle();
    if (!a?.email) throw new Error("Applicant has no email on file.");

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#111">${esc(
      data.body,
    ).replace(/\n/g, "<br>")}</div>`;

    let status = "pending";
    let error: string | null = null;
    try {
      const { sendRawEmail } = await import("@/lib/email-templates/send-email");
      const r = await sendRawEmail(a.email, data.subject, html, {
        idempotencyKey: `compose-${data.id}-${Date.now()}`,
      });
      status = r.sent ? "sent" : "skipped";
    } catch (e) {
      status = "failed";
      error = (e as Error).message;
    }

    try {
      await (supabase as any).rpc("enqueue_email", {
        payload: {
          to_email: a.email,
          to_name: [a.first_name, a.last_name].filter(Boolean).join(" ") || null,
          subject: data.subject,
          html,
          template_key: "custom",
          applicant_id: data.id,
          status,
          error,
        },
      });
    } catch {
      /* best-effort outbox log */
    }

    await supabase.from("applicant_activities").insert({
      applicant_id: data.id,
      event_type: "email_sent",
      summary: `Email sent: ${data.subject}`,
      actor_id: userId,
      data: { subject: data.subject },
    } as never);
    await supabase
      .from("applicants")
      .update({ last_contacted_at: new Date().toISOString() } as never)
      .eq("id", data.id);

    return { ok: true, status };
  });

/** Admin: a single agent's profile + roles + their onboarding progress. */
export const adminGetAgentProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [{ data: profile }, { data: roles }, { data: applicant }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", data.user_id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", data.user_id),
      supabase
        .from("applicants")
        .select("id, onboarding_steps, onboarding_completed_at, current_stage_id, recruiting_status")
        .eq("portal_profile_id", data.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (!profile) throw new Error("User not found");
    return {
      profile,
      roles: (roles ?? []).map((r: { role: string }) => r.role),
      applicant: applicant ?? null,
    };
  });

/** Active profiles the caller can assign as recruiter/manager (RLS scopes it). */
export const listAssignableUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("is_active", true)
      .order("first_name");
    const users = (data ?? []).map((p: any) => ({
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unnamed",
    }));
    return { users };
  });

/* ============================================================
   Admin functions
   ============================================================ */

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.some((r: string) => r === "admin" || r === "super_admin")) {
    throw new Error("Forbidden: admin only");
  }
  return roles;
}

// Admins, or managers/leaders granted can_manage_resources, may write resources.
async function assertCanManageResources(supabase: any, userId: string) {
  const [{ data: roleRows }, { data: prof }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("can_manage_resources").eq("id", userId).maybeSingle(),
  ]);
  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  const isAdmin = roles.some((r: string) => r === "admin" || r === "super_admin");
  if (!isAdmin && !prof?.can_manage_resources) {
    throw new Error("Forbidden: you are not permitted to manage resources");
  }
}

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [profilesRes, rolesRes, teamsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("teams").select("*").order("name"),
    ]);
    const roleMap: Record<string, string[]> = {};
    for (const r of rolesRes.data ?? []) {
      (roleMap[r.user_id] ??= []).push(r.role);
    }
    return {
      users: (profilesRes.data ?? []).map((p: any) => ({ ...p, roles: roleMap[p.id] ?? [] })),
      teams: teamsRes.data ?? [],
    };
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        // super_admin is a protected internal owner level and is never selectable.
        role: z.enum(["agent", "leader", "manager", "admin"]),
        grant: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.grant) {
      await supabase
        .from("user_roles")
        .upsert({ user_id: data.user_id, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabase.from("user_roles").delete().eq("user_id", data.user_id).eq("role", data.role);
    }
    await writeAudit(supabase, {
      action: data.grant ? "role_granted" : "role_revoked",
      actor_id: userId,
      target_user_id: data.user_id,
      new_value: { role: data.role },
    });
    return { ok: true };
  });

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        phone: z.string().optional(),
        team_id: z.string().uuid().nullable().optional(),
        parent_user_id: z.string().uuid().nullable().optional(),
        is_active: z.boolean().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        can_receive_applicants: z.boolean().optional(),
        can_invite_agents: z.boolean().optional(),
        can_invite_leaders: z.boolean().optional(),
        can_manage_resources: z.boolean().optional(),
        recruiting_slug: z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            "Slug may only contain lowercase letters, numbers and hyphens",
          )
          .max(120)
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { id, ...rest } = data;
    const { error } = await supabase.from("profiles").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListStages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data } = await supabase.from("pipeline_stages").select("*").order("position");
    return { stages: data ?? [] };
  });

export const adminUpsertStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        slug: z.string().min(1),
        color: z.string().optional(),
        position: z.number().int(),
        is_archived: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.id) {
      const { error } = await supabase.from("pipeline_stages").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("pipeline_stages").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data } = await supabase.from("system_settings").select("*");
    return { settings: data ?? [] };
  });

export const adminSetSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().min(1), value: z.any() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: data.key, value: data.value }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Post a sample "new recruit" card to the configured Discord webhook so the
 *  admin can confirm the bot lands in the right channel. Admin-only. */
export const adminTestDiscordWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { getDiscordWebhookUrlAsAdmin, postRecruitAlert } = await import("@/lib/discord.server");
    const url = await getDiscordWebhookUrlAsAdmin();
    if (!url) {
      return {
        ok: false,
        message: "No valid Discord webhook URL saved yet. Paste one above and save it first.",
      };
    }
    const sent = await postRecruitAlert(url, {
      firstName: "Test",
      lastName: "Recruit",
      recruiterName: "Vantage Financial",
      licensed: false,
      requestedOverviewAt: null,
      wantsOneOnOne: false,
      state: "TX",
    });
    return {
      ok: sent,
      message: sent
        ? "Test card posted — check your Discord channel."
        : "Discord rejected the post. Double-check the webhook URL.",
    };
  });


/* ============================================================
   Tasks
   ============================================================ */

const taskInput = z.object({
  scope: z.enum(["mine", "all"]).optional().default("mine"),
  status: z.enum(["open", "done", "all"]).optional().default("open"),
});

export const listTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => taskInput.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("tasks")
      .select(
        "id, title, notes, due_at, completed_at, priority, assigned_to, created_by, applicant_id, created_at, applicants(first_name, last_name)",
      )
      .order("completed_at", { ascending: true, nullsFirst: true })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.scope === "mine") q = q.eq("assigned_to", userId);
    if (data.status === "open") q = q.is("completed_at", null);
    if (data.status === "done") q = q.not("completed_at", "is", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { tasks: rows ?? [] };
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        notes: z.string().max(2000).optional(),
        due_at: z.string().datetime().optional().nullable(),
        priority: z.enum(["low", "normal", "high"]).optional().default("normal"),
        assigned_to: z.string().uuid().optional().nullable(),
        applicant_id: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("tasks").insert({
      title: data.title,
      notes: data.notes ?? null,
      due_at: data.due_at ?? null,
      priority: data.priority,
      assigned_to: data.assigned_to ?? userId,
      created_by: userId,
      applicant_id: data.applicant_id ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("tasks")
      .update({ completed_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================
   Calendar
   ============================================================ */

export const getCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        scope: z.enum(["mine", "all"]).optional().default("mine"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let apps = supabase
      .from("applicants")
      .select("id, first_name, last_name, calendly_scheduled_at, assigned_recruiter_id")
      .not("calendly_scheduled_at", "is", null)
      .gte("calendly_scheduled_at", data.from)
      .lte("calendly_scheduled_at", data.to);
    if (data.scope === "mine") apps = apps.eq("assigned_recruiter_id", userId);

    let tasks = supabase
      .from("tasks")
      .select("id, title, due_at, completed_at, priority, assigned_to")
      .not("due_at", "is", null)
      .gte("due_at", data.from)
      .lte("due_at", data.to);
    if (data.scope === "mine") tasks = tasks.eq("assigned_to", userId);

    const [appsRes, tasksRes] = await Promise.all([apps, tasks]);
    return { appointments: appsRes.data ?? [], tasks: tasksRes.data ?? [] };
  });

/* ============================================================
   Leaderboard
   ============================================================ */

export const getLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        window: z.enum(["7d", "30d", "90d", "all"]).optional().default("30d"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const days =
      data.window === "7d" ? 7 : data.window === "30d" ? 30 : data.window === "90d" ? 90 : 3650;
    const since = new Date(Date.now() - days * 86400_000).toISOString();

    const [appsRes, profilesRes] = await Promise.all([
      supabase
        .from("applicants")
        .select(
          "assigned_recruiter_id, calendly_scheduled_at, evaluation_completed_at, created_at, current_stage_id, pipeline_stages(is_completed_stage)",
        )
        .gte("created_at", since)
        .not("assigned_recruiter_id", "is", null),
      supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .eq("is_active", true),
    ]);

    const byUser: Record<
      string,
      {
        user_id: string;
        applicants: number;
        scheduled: number;
        evaluated: number;
        onboarded: number;
      }
    > = {};
    for (const p of profilesRes.data ?? []) {
      byUser[p.id] = { user_id: p.id, applicants: 0, scheduled: 0, evaluated: 0, onboarded: 0 };
    }
    for (const a of appsRes.data ?? []) {
      const uid = a.assigned_recruiter_id as string | null;
      if (!uid) continue;
      const row = (byUser[uid] ??= {
        user_id: uid,
        applicants: 0,
        scheduled: 0,
        evaluated: 0,
        onboarded: 0,
      });
      row.applicants += 1;
      if (a.calendly_scheduled_at) row.scheduled += 1;
      if (a.evaluation_completed_at) row.evaluated += 1;
      const stage = a.pipeline_stages as { is_completed_stage: boolean } | null;
      if (stage?.is_completed_stage) row.onboarded += 1;
    }
    const profileMap: Record<
      string,
      { first_name: string | null; last_name: string | null; avatar_url: string | null }
    > = {};
    for (const p of profilesRes.data ?? []) profileMap[p.id] = p;

    const rows = Object.values(byUser)
      .map((r) => ({
        ...r,
        profile: profileMap[r.user_id] ?? null,
        score: r.onboarded * 10 + r.evaluated * 3 + r.scheduled * 2 + r.applicants,
      }))
      .filter((r) => r.applicants > 0 || r.scheduled > 0 || r.evaluated > 0 || r.onboarded > 0)
      .sort((a, b) => b.score - a.score);

    return { rows };
  });

/* ============================================================
   Resources
   ============================================================ */

export const listResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("resources")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    return { resources: data ?? [] };
  });

export const upsertResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(1),
        description: z.string().optional().nullable(),
        category: z.string().min(1),
        url: z.string().url().optional().nullable(),
        kind: z.enum(["link", "doc", "video"]).optional().default("link"),
        position: z.number().int().optional().default(0),
        is_published: z.boolean().optional().default(true),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Admins manage all resources; managers granted can_manage_resources manage
    // their own (RLS enforces ownership on write for non-admins).
    await assertCanManageResources(supabase, userId);
    if (data.id) {
      const { id, ...rest } = data;
      const patch: Record<string, unknown> = { ...rest, updated_by: userId };
      if (rest.is_published) patch.published_by = userId;
      const { error } = await supabase
        .from("resources")
        .update(patch as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("resources").insert({
        ...data,
        created_by: userId,
        updated_by: userId,
        published_by: data.is_published ? userId : null,
      } as never);
      if (error) throw new Error(error.message);
    }
    await writeAudit(supabase, {
      action: data.is_published ? "resource_published" : "resource_saved",
      actor_id: userId,
      new_value: { title: data.title, category: data.category },
    });
    return { ok: true };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("resources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================
   Scheduling settings (per-user)
   ============================================================ */

const calendlyUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/calendly\.com\/[A-Za-z0-9\-_/?&=.%#]+$/.test(v), {
    message: "Must be a valid https://calendly.com/... URL",
  });

export const getMySchedulingSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select(
        "licensed_calendly_url, can_schedule_licensed, licensed_calendly_updated_at, one_on_one_calendly_url, one_on_one_calendly_updated_at",
      )
      .eq("id", userId)
      .maybeSingle();
    const row = (data ?? null) as
      | (typeof data & {
          one_on_one_calendly_url?: string | null;
          one_on_one_calendly_updated_at?: string | null;
        })
      | null;
    const roles = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roleList = (roles.data ?? []).map((r) => r.role as string);
    const isPrivileged = roleList.some(
      (r) => r === "manager" || r === "admin" || r === "super_admin",
    );
    // Leaders own the 1:1 call link — applicants under their downline book with them.
    const isLeader = isPrivileged || roleList.includes("leader");
    return {
      licensed_calendly_url: row?.licensed_calendly_url ?? "",
      can_schedule_licensed: row?.can_schedule_licensed ?? false,
      licensed_calendly_updated_at: row?.licensed_calendly_updated_at ?? null,
      one_on_one_calendly_url: row?.one_on_one_calendly_url ?? "",
      one_on_one_calendly_updated_at: row?.one_on_one_calendly_updated_at ?? null,
      can_edit_one_on_one: isLeader,
      can_edit: isPrivileged || (row?.can_schedule_licensed ?? false),
    };
  });

export const updateMySchedulingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        licensed_calendly_url: calendlyUrlSchema.optional(),
        one_on_one_calendly_url: calendlyUrlSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const roles = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roleList = (roles.data ?? []).map((r) => r.role as string);
    const { data: prof } = await supabase
      .from("profiles")
      .select("can_schedule_licensed")
      .eq("id", userId)
      .maybeSingle();
    const isPrivileged = roleList.some(
      (r) => r === "manager" || r === "admin" || r === "super_admin",
    );
    const patch: Record<string, string | null> = {};
    if (data.licensed_calendly_url !== undefined) {
      if (!isPrivileged && !prof?.can_schedule_licensed) {
        throw new Error("You don't have permission to set a licensed Calendly link.");
      }
      patch.licensed_calendly_url = data.licensed_calendly_url || null;
      patch.licensed_calendly_updated_at = new Date().toISOString();
    }
    if (data.one_on_one_calendly_url !== undefined) {
      if (!isPrivileged && !roleList.includes("leader")) {
        throw new Error("You don't have permission to set a 1:1 call link.");
      }
      patch.one_on_one_calendly_url = data.one_on_one_calendly_url || null;
      patch.one_on_one_calendly_updated_at = new Date().toISOString();
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("profiles")
      .update(patch as never)
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetAgentScheduling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        can_schedule_licensed: z.boolean().optional(),
        licensed_calendly_url: calendlyUrlSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const patch: {
      can_schedule_licensed?: boolean;
      licensed_calendly_url?: string | null;
      licensed_calendly_updated_at?: string;
    } = {};
    if (data.can_schedule_licensed !== undefined)
      patch.can_schedule_licensed = data.can_schedule_licensed;
    if (data.licensed_calendly_url !== undefined) {
      patch.licensed_calendly_url = data.licensed_calendly_url || null;
      patch.licensed_calendly_updated_at = new Date().toISOString();
    }
    const { error } = await supabase.from("profiles").update(patch).eq("id", data.user_id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Self-service profile + notification settings ------------------------

/** Update the signed-in user's own profile (name, phone, avatar). */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        first_name: z.string().trim().max(80).optional(),
        last_name: z.string().trim().max(80).optional(),
        phone: z.string().trim().max(40).optional().or(z.literal("")),
        npn: z.string().trim().max(40).optional().or(z.literal("")),
        resident_state: z.string().trim().max(60).optional().or(z.literal("")),
        avatar_url: z.string().trim().url().max(600).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.first_name !== undefined) patch.first_name = data.first_name;
    if (data.last_name !== undefined) patch.last_name = data.last_name;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    if (data.npn !== undefined) patch.npn = data.npn || null;
    if (data.resident_state !== undefined) patch.resident_state = data.resident_state || null;
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url || null;
    // full_name is a generated column in the database — it updates itself from
    // first_name/last_name and must never be written directly.

    const { error } = await supabase.from("profiles").update(patch as never).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Save the signed-in user's notification toggles (jsonb map). */
export const updateMyNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ prefs: z.record(z.string(), z.boolean()) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: data.prefs, updated_at: new Date().toISOString() } as never)
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Manual applicant entry (Phase 4) ------------------------------------

/** Users the caller may assign applicants to: self + downline (admins: all). */
export const getAssignableRecruiters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    const isAdmin = roles.some((r) => r === "admin" || r === "super_admin");

    let q = supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("is_active", true);
    if (!isAdmin) {
      const { data: desc } = await (supabase as any).rpc("descendant_ids", { _root: userId });
      const ids = [userId, ...((desc ?? []) as { id: string }[]).map((d) => d.id)];
      q = q.in("id", ids);
    }
    const { data: profs } = await q;
    const recruiters = ((profs ?? []) as any[]).map((p) => ({
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unnamed",
    }));
    const [{ data: teams }, { data: sources }, { data: stages }] = await Promise.all([
      supabase.from("teams").select("id, name").order("name"),
      supabase.from("applicant_sources").select("id, slug, label").eq("is_active", true),
      supabase
        .from("pipeline_stages")
        .select("id, name, slug, color, position")
        .eq("is_archived", false)
        .order("position"),
    ]);
    return {
      recruiters,
      teams: teams ?? [],
      sources: sources ?? [],
      stages: stages ?? [],
      defaultRecruiterId: userId,
    };
  });

const manualApplicantSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  state: z.string().trim().max(4).optional().or(z.literal("")),
  licensed: z.boolean().optional(),
  instagram_handle: z.string().trim().max(80).optional().or(z.literal("")),
  why_text: z.string().trim().max(2000).optional().or(z.literal("")),
  assigned_recruiter_id: z.string().uuid(),
  referred_by_profile_id: z.string().uuid().optional().or(z.literal("")),
  team_id: z.string().uuid().optional().or(z.literal("")),
  source_id: z.string().uuid().optional().or(z.literal("")),
  stage_id: z.string().uuid().optional().or(z.literal("")),
  priority: z.enum(["low", "normal", "high"]).optional(),
  next_follow_up_at: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

/** Manually create an applicant assigned within the caller's permission scope.
 *  Row-level security enforces that the assignee is self / downline / admin. */
export const createApplicantManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => manualApplicantSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const assigned = data.assigned_recruiter_id;
    const referred = data.referred_by_profile_id || assigned;

    let stageId = data.stage_id || "";
    if (!stageId) {
      const { data: st } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("slug", "new-applicant")
        .maybeSingle();
      stageId = st?.id ?? "";
    }

    const insert: Record<string, unknown> = {
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone || null,
      state: data.state ? data.state.toUpperCase() : null,
      licensed: data.licensed ?? false,
      licensing_status: data.licensed ? "licensed" : "unlicensed",
      instagram_handle: data.instagram_handle || null,
      why_text: data.why_text || null,
      consent_contact: true,
      assigned_recruiter_id: assigned,
      original_recruiter_id: referred,
      referred_by_profile_id: referred,
      referral_source: "manual",
      team_id: data.team_id || null,
      source_id: data.source_id || null,
      current_stage_id: stageId || null,
      stage_entered_at: new Date().toISOString(),
      priority: data.priority ?? "normal",
      next_follow_up_at: data.next_follow_up_at || null,
    };

    const { data: created, error } = await supabase
      .from("applicants")
      .insert(insert as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("applicant_activities").insert({
      applicant_id: created.id,
      event_type: "manual_applicant_created",
      summary: "Applicant added manually",
    } as never);
    if (data.notes && data.notes.trim()) {
      await supabase.from("applicant_activities").insert({
        applicant_id: created.id,
        event_type: "note",
        summary: data.notes.trim(),
      } as never);
    }

    return { id: created.id as string };
  });

// ---- Add Agent: manual onboarding fast-path ------------------------------

/** Every portal user may invite agents — we only verify the caller has an
 *  active profile so we never create an orphan applicant. */
async function assertCanInviteAgent(supabase: any, userId: string) {
  const { data: prof } = await supabase
    .from("profiles")
    .select("id, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (!prof || prof.is_active === false) {
    throw new Error("You're not permitted to add agents.");
  }
}

export const addAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(200),
        phone: z.string().trim().min(7).max(40),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanInviteAgent(supabase, userId);

    const parts = data.full_name.trim().split(/\s+/);
    const first_name = parts[0];
    const last_name = parts.slice(1).join(" ");

    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("slug", "onboarding")
      .maybeSingle();
    if (!stage?.id) throw new Error("Onboarding stage is not configured.");

    // Create the applicant directly at Onboarding (trigger seeds onboarding_steps).
    const { data: created, error } = await supabase
      .from("applicants")
      .insert({
        first_name,
        last_name,
        email: data.email.toLowerCase(),
        phone: data.phone,
        licensed: true,
        licensing_status: "licensed",
        consent_contact: true,
        assigned_recruiter_id: userId,
        original_recruiter_id: userId,
        referred_by_profile_id: userId,
        referral_source: "manual_add",
        current_stage_id: stage.id,
        stage_entered_at: new Date().toISOString(),
      } as never)
      .select("id, email, first_name, last_name, portal_profile_id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("applicant_activities").insert({
      applicant_id: created.id,
      event_type: "manual_applicant_created",
      summary: "Agent added manually — sent to onboarding",
      actor_id: userId,
    } as never);

    // Mint the invitation up front so the welcome email carries a real link.
    try {
      await supabase.rpc("create_invitation", {
        payload: {
          email: created.email,
          first_name: created.first_name ?? "",
          last_name: created.last_name ?? "",
          role: "agent",
          applicant_id: created.id,
        },
      });
    } catch (e) {
      // Non-fatal: the applicant exists; the email helper falls back to /login.
      // eslint-disable-next-line no-console
      console.warn("[addAgent] create_invitation failed:", e);
    }

    await enqueueWelcomeOnboarding(supabase, created as OnboardingApplicant);

    return { id: created.id as string };
  });

// ---- Company-wide leaderboard (Phase 6) ----------------------------------

export const getCompanyLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        metric: z
          .enum([
            "new_applicants",
            "contacted",
            "interviews_scheduled",
            "interviews_completed",
            "promoted",
          ])
          .optional()
          .default("new_applicants"),
        period: z
          .enum(["today", "week", "month", "quarter", "year", "all"])
          .optional()
          .default("month"),
        role: z.enum(["agent", "leader", "manager", "admin"]).optional().or(z.literal("")),
        team_id: z.string().uuid().optional().or(z.literal("")),
        state: z.string().trim().max(4).optional().or(z.literal("")),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await (supabase as any).rpc("company_leaderboard", {
      payload: data,
    });
    if (error) throw new Error(error.message);
    // Filter options (teams) for the UI.
    const { data: teams } = await supabase.from("teams").select("id, name").order("name");
    return { rows: (rows ?? []) as CompanyLeaderboardRow[], meId: userId, teams: teams ?? [] };
  });

export type CompanyLeaderboardRow = {
  profile_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  team_name: string | null;
  manager_name: string | null;
  new_count: number;
  contacted_count: number;
  scheduled_count: number;
  completed_count: number;
  promoted_count: number;
  conversion: number;
  total: number;
  prev_total: number;
};

// ---- Organization tree + audit log (Phase 7) -----------------------------

export type OrgNode = {
  id: string;
  name: string;
  role: string | null;
  parent_user_id: string | null;
  team_name: string | null;
};

/** Flat list of the caller's org (self + full downline); admins get everyone. */
export const getOrganizationTree = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    const isAdmin = roles.some((r) => r === "admin" || r === "super_admin");

    let q = supabase
      .from("profiles")
      .select("id, first_name, last_name, email, parent_user_id, team_id, teams(name)")
      .eq("is_active", true);
    if (!isAdmin) {
      const { data: desc } = await (supabase as any).rpc("descendant_ids", { _root: userId });
      const ids = [userId, ...((desc ?? []) as { id: string }[]).map((d) => d.id)];
      q = q.in("id", ids);
    }
    const { data: profs } = await q;

    // Resolve each person's primary role in one pass.
    const ids = ((profs ?? []) as any[]).map((p) => p.id);
    const { data: allRoles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids);
    const roleOrder = ["super_admin", "admin", "manager", "leader", "agent"];
    const roleByUser: Record<string, string> = {};
    for (const r of (allRoles ?? []) as { user_id: string; role: string }[]) {
      const cur = roleByUser[r.user_id];
      if (!cur || roleOrder.indexOf(r.role) < roleOrder.indexOf(cur))
        roleByUser[r.user_id] = r.role;
    }

    const nodes: OrgNode[] = ((profs ?? []) as any[]).map((p) => ({
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unnamed",
      role: roleByUser[p.id] === "super_admin" ? "admin" : (roleByUser[p.id] ?? null),
      parent_user_id: p.parent_user_id,
      team_name: (p.teams as { name: string } | null)?.name ?? null,
    }));
    return { nodes, rootId: isAdmin ? null : userId };
  });

export const getAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ action: z.string().optional().or(z.literal("")) }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    let q = (supabase as any)
      .from("audit_logs")
      .select("id, action, actor_id, target_user_id, target_applicant_id, new_value, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.action) q = q.eq("action", data.action);
    const { data: logs, error } = await q;
    if (error) throw new Error(error.message);
    return { logs: logs ?? [] };
  });

/* ------------------------------------------------------------------ */
/* State exam                                                          */
/* ------------------------------------------------------------------ */

/** Recruiter sets the state exam details — moves the applicant to State Exam,
 *  puts the exam on the recruiting calendar, and starts exam reminders. */
export const setApplicantExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        exam_date: z.string().min(10).max(40),
        exam_provider: z.string().trim().max(120).optional().or(z.literal("")),
        exam_notes: z.string().trim().max(1000).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const engine = await import("@/lib/recruiting/stage-engine.server");
    const iso = new Date(data.exam_date).toISOString();
    const res = await engine.applyStage({
      applicantId: data.id,
      stage: "state-exam",
      actorId: userId,
      reason: "exam_scheduled",
      patch: {
        exam_date: iso,
        exam_provider: data.exam_provider || null,
        exam_notes: data.exam_notes || null,
        exam_result: null,
      },
      sendKey: `exam:${data.id}:${iso}`,
    });
    await engine.logActivity(
      data.id,
      "exam_scheduled",
      "State Exam Scheduled",
      { exam_date: iso, provider: data.exam_provider || null },
      userId,
    );
    // Re-anchor reminders whenever the date moves.
    await engine.startSequence(data.id, "exam_reminders", iso);
    if (!res.ok) throw new Error("Could not save the exam");
    return { ok: true as const };
  });

/** Recruiter marks the exam passed — moves the applicant to Licensing. */
export const markExamResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), result: z.enum(["passed", "failed"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { userId, supabase } = context;
    const engine = await import("@/lib/recruiting/stage-engine.server");
    const now = new Date().toISOString();
    if (data.result === "failed") {
      await supabase
        .from("applicants")
        .update({ exam_result: "failed" } as never)
        .eq("id", data.id);
      await engine.logActivity(data.id, "exam_failed", "State Exam Not Passed", {}, userId);
      return { ok: true as const };
    }
    await engine.stopSequence(data.id, "exam_reminders", "exam_passed");
    const res = await engine.applyStage({
      applicantId: data.id,
      stage: "licensing",
      actorId: userId,
      reason: "exam_passed",
      patch: { exam_result: "passed", exam_passed_at: now },
      sendKey: `licensing:${data.id}`,
    });
    await engine.logActivity(data.id, "exam_passed", "State Exam Passed", { at: now }, userId);
    if (!res.ok) throw new Error("Could not update the record");
    return { ok: true as const };
  });

/** Quick action: start (or restart) the capped follow-up series. */
export const startApplicantFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { userId, supabase } = context;
    const engine = await import("@/lib/recruiting/stage-engine.server");
    await supabase
      .from("applicants")
      .update({ recruiting_status: "follow_up" } as never)
      .eq("id", data.id);
    await engine.startSequence(data.id, "no_show_followup", new Date().toISOString());
    await engine.logActivity(data.id, "follow_up_started", "Follow up started", {}, userId);
    return { ok: true as const };
  });

export type OnboardingContext = {
  isAdmin: boolean;
  prefill: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
    npn: string | null;
  };
  upline: { name: string; role: string | null } | null;
  playbook: { slug: string; title: string } | null;
  closerCourse: { slug: string; title: string; published: boolean } | null;
};

/** Contextual data for the onboarding checklist: the agent's nearest upline in
 *  the Vantage hierarchy, the details to reuse during Agent Cloud setup, and the
 *  live Academy records backing the Playbook and Closer Course steps. */
export const getOnboardingContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingContext> => {
    const { supabase, userId } = context;
    const sb = supabase as any;

    const { data: roleRows } = await sb.from("user_roles").select("role").eq("user_id", userId);
    const myRoles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
    const isAdmin = myRoles.some((r) => r === "admin" || r === "super_admin");

    // Hierarchy/recruiter lookups need to read rows above the caller, which the
    // caller's own RLS scope hides — resolve them with the privileged client
    // (read-only, and only after the caller is authenticated above).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: me } = await sb
      .from("profiles")
      .select("id, first_name, last_name, full_name, email, phone, npn, parent_user_id")
      .eq("id", userId)
      .maybeSingle();

    const { data: meFull } = await admin
      .from("profiles")
      .select("id, parent_user_id, manager_id")
      .eq("id", userId)
      .maybeSingle();

    const { data: app } = await admin
      .from("applicants")
      .select(
        "id, first_name, last_name, email, phone, npn, assigned_recruiter_id, original_recruiter_id, assigned_manager_id, referred_by_profile_id, referred_by_name_snapshot, referred_by_name",
      )
      .eq("portal_profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const fullName =
      (me?.full_name as string | null) ||
      [me?.first_name, me?.last_name].filter(Boolean).join(" ") ||
      [app?.first_name, app?.last_name].filter(Boolean).join(" ") ||
      null;

    const nameOf = (p: any) =>
      (p?.full_name as string | null) ||
      [p?.first_name, p?.last_name].filter(Boolean).join(" ") ||
      (p?.email as string | null) ||
      null;

    const primaryRole = (roles: string[]) =>
      ["super_admin", "admin", "manager", "leader", "agent"].find((r) => roles.includes(r)) ?? null;

    const profileUpline = async (id: string | null | undefined) => {
      if (!id) return null;
      const { data: p } = await admin
        .from("profiles")
        .select("id, first_name, last_name, full_name, email")
        .eq("id", id)
        .maybeSingle();
      const name = nameOf(p);
      if (!name) return null;
      const { data: rr } = await admin.from("user_roles").select("role").eq("user_id", id);
      return {
        name,
        role: primaryRole(((rr ?? []) as { role: string }[]).map((x) => x.role)),
      };
    };

    // Whoever they signed up under, in order of confidence: recruiter on the
    // applicant record, referring agent, assigned manager, then the reporting
    // hierarchy. Never leaves the step blank when any name is known.
    let upline: { name: string; role: string | null } | null =
      (await profileUpline(app?.assigned_recruiter_id as string | null)) ??
      (await profileUpline(app?.original_recruiter_id as string | null)) ??
      (await profileUpline(app?.referred_by_profile_id as string | null)) ??
      (await profileUpline(app?.assigned_manager_id as string | null)) ??
      (await profileUpline(meFull?.manager_id as string | null)) ??
      (await profileUpline((meFull?.parent_user_id ?? me?.parent_user_id) as string | null));

    if (!upline) {
      const snapshot =
        ((app?.referred_by_name_snapshot as string | null) ||
          (app?.referred_by_name as string | null) ||
          "").trim() || null;
      if (snapshot) upline = { name: snapshot, role: null };
    }


    // Resolve the published Agent Playbook out of the Academy library.
    const { data: resources } = await sb
      .from("library_resources")
      .select("slug, title, status")
      .eq("status", "published")
      .ilike("title", "%playbook%")
      .order("position", { ascending: true });
    const playbookRow = ((resources ?? []) as any[]).find((r) => r.slug) ?? null;

    // Resolve the existing Vantage Closer Course.
    const { data: courses } = await sb
      .from("courses")
      .select("slug, title, status")
      .ilike("title", "%closer%")
      .order("created_at", { ascending: true });
    const courseRow = ((courses ?? []) as any[]).find((c) => c.slug) ?? null;

    return {
      isAdmin,
      prefill: {
        fullName,
        email: (me?.email as string | null) ?? (app?.email as string | null) ?? null,
        phone: (me?.phone as string | null) ?? (app?.phone as string | null) ?? null,
        npn: (me?.npn as string | null) ?? (app?.npn as string | null) ?? null,
      },
      upline,
      playbook: playbookRow ? { slug: playbookRow.slug, title: playbookRow.title } : null,
      closerCourse: courseRow
        ? { slug: courseRow.slug, title: courseRow.title, published: courseRow.status === "published" }
        : null,
    };
  });
