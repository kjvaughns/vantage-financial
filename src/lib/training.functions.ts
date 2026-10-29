/**
 * New Agent Release Track: Monday–Thursday training days, homework review and
 * the release call. Progress lives per agent profile and is mirrored onto the
 * agent's applicant record (unlock, release, cleared to call) so the whole
 * journey stays on one profile.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManage } from "@/lib/academy/guard";
import { validateHomeworkRecording } from "@/lib/training-homework";

export type TrainingDay = {
  id: string;
  slug: string;
  title: string;
  day_label: string | null;
  position: number;
  video_url: string | null;
  objective: string | null;
  prompt: string | null;
  instructions: string | null;
  checklist: string[];
  is_release: boolean;
  is_published: boolean;
  created_at?: string;
};

export type TrainingSubmission = {
  id: string;
  profile_id: string;
  day_id: string;
  file_path: string | null;
  link_url: string | null;
  note: string | null;
  status: "submitted" | "approved" | "redo";
  feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  review_id: string | null;
  file_url?: string | null;
  review?: { id: string; status: string; overall: number | null } | null;
};

export type DayState = "locked" | "open" | "submitted" | "redo" | "approved";

const DAY_COLS =
  "id, slug, title, day_label, position, video_url, objective, prompt, instructions, checklist, is_release, is_published, created_at";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Pure unlock + per-day state calculation, shared by agent and reviewer views. */
export function computeTrack(
  days: TrainingDay[],
  progress: { day_id: string; approved_at: string | null }[],
  submissions: TrainingSubmission[],
  unlocked: boolean,
): { day: TrainingDay; state: DayState; latest: TrainingSubmission | null }[] {
  const approved = new Set(progress.filter((p) => p.approved_at).map((p) => p.day_id));
  let prevDone = unlocked;
  return days.map((day) => {
    const mine = submissions
      .filter((s) => s.day_id === day.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const latest = mine[0] ?? null;
    let state: DayState;
    // The release call is open as soon as training unlocks; agents may attempt it anytime.
    // All days open together once training unlocks (no day-by-day gating).
    const gateOpen = unlocked;
    if (approved.has(day.id)) state = "approved";
    else if (!gateOpen) state = "locked";
    else if (latest?.status === "submitted") state = "submitted";
    else if (latest?.status === "redo") state = "redo";
    else state = "open";
    if (!day.is_release) prevDone = state === "approved";
    return { day, state, latest };
  });
}

async function applicantForProfile(profileId: string) {
  const sb = await admin();
  const { data } = await sb
    .from("applicants")
    .select(
      "id, first_name, last_name, email, onboarding_completed_at, training_unlocked_at, release_requested_at, release_passed_at, cleared_to_call_at, assigned_recruiter_id",
    )
    .eq("portal_profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

function isUnlocked(a: { onboarding_completed_at: string | null; training_unlocked_at: string | null } | null) {
  // Agents added before the applicant journey existed have no record: leave them unlocked.
  if (!a) return true;
  return !!(a.onboarding_completed_at || a.training_unlocked_at);
}

async function loadTrack(sb: any, profileId: string, withUrls: boolean) {
  const [{ data: days }, { data: progress }, { data: subs }] = await Promise.all([
    sb.from("training_days").select(DAY_COLS).eq("is_published", true).order("position"),
    sb.from("training_progress").select("day_id, approved_at, approved_by, is_override").eq("profile_id", profileId),
    sb.from("training_submissions").select("*").eq("profile_id", profileId).order("created_at", { ascending: false }),
  ]);
  const submissions = (subs ?? []) as TrainingSubmission[];
  if (withUrls) await attachUrls(sb, submissions);
  return { days: (days ?? []) as TrainingDay[], progress: progress ?? [], submissions };
}

async function attachUrls(sb: any, subs: TrainingSubmission[]) {
  await Promise.all(
    subs.map(async (s) => {
      if (!s.file_path) return;
      const { data } = await sb.storage.from("training-submissions").createSignedUrl(s.file_path, 60 * 60);
      s.file_url = data?.signedUrl ?? null;
    }),
  );
}

async function log(applicantId: string | undefined, type: string, summary: string, data: Record<string, unknown>, actor: string) {
  if (!applicantId) return;
  const { logActivity } = await import("@/lib/recruiting/stage-engine.server");
  await logActivity(applicantId, type, summary, data, actor);
}

async function emailProfile(profileId: string, template: string, context: Record<string, string>, sendKey: string) {
  try {
    const sb = await admin();
    const { data: p } = await sb.from("profiles").select("email, first_name, full_name").eq("id", profileId).maybeSingle();
    if (!p?.email) return;
    const { sendEmail } = await import("@/lib/email/dispatch.server");
    const site = process.env["SITE_URL"] || "https://vantage-financial.net";
    await sendEmail({
      template,
      to: p.email,
      toName: p.full_name ?? null,
      profileId,
      context: { first_name: p.first_name ?? "there", training_link: `${site}/portal/training`, review_link: `${site}/portal/admin/training`, ...context },
      sendKey,
      automated: true,
    } as any);
  } catch (e) {
    console.warn("[training] email failed", template, e);
  }
}

/* ------------------------------ Agent ------------------------------ */

export const getMyTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const a = await applicantForProfile(context.userId);
    const unlocked = isUnlocked(a);
    const t = await loadTrack(context.supabase, context.userId, false);
    // Attach Call Coach analysis status so the training page can show and poll it.
    const reviewIds = t.submissions.map((s) => s.review_id).filter((x): x is string => !!x);
    if (reviewIds.length) {
      const { data: reviews } = await context.supabase.from("call_reviews").select("id, status, overall").in("id", reviewIds);
      const rmap = new Map((reviews ?? []).map((r: any) => [r.id, r]));
      for (const s of t.submissions) s.review = s.review_id ? ((rmap.get(s.review_id) as any) ?? null) : null;
    }
    return {
      unlocked,
      onboardingDone: !!a?.onboarding_completed_at,
      releaseRequestedAt: a?.release_requested_at ?? null,
      clearedAt: a?.cleared_to_call_at ?? null,
      track: computeTrack(t.days, t.progress, t.submissions, unlocked),
    };
  });

export const submitHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        dayId: z.string().uuid(),
        filePath: z.string().max(400).nullable().optional(),
        linkUrl: z.string().url().max(1000).nullable().optional(),
        note: z.string().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const a = await applicantForProfile(userId);
    const unlocked = isUnlocked(a);
    const t = await loadTrack(supabase, userId, false);
    const entry = computeTrack(t.days, t.progress, t.submissions, unlocked).find((e) => e.day.id === data.dayId);
    if (!entry) throw new Error("That training day isn't available.");
    if (entry.state === "locked") throw new Error("This day is still locked.");
    if (entry.state === "approved") throw new Error("This day is already approved.");
    if (entry.state === "submitted" && !entry.day.is_release) throw new Error("You already submitted this — wait for review.");
    if (data.filePath && !data.filePath.startsWith(`${userId}/`)) throw new Error("Invalid upload.");
    validateHomeworkRecording(entry.day.is_release, data.linkUrl, data.filePath);

    const { data: sub, error } = await supabase.from("training_submissions").insert({
      profile_id: userId,
      day_id: data.dayId,
      file_path: data.filePath ?? null,
      link_url: data.linkUrl?.trim() || null,
      note: data.note ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);

    const label = `${entry.day.day_label ?? ""} ${entry.day.title}`.trim();

    // Every homework recording gets a Call Coach review, analyzed automatically.
    const driveLink = data.linkUrl?.trim() || null;
    if (driveLink) {
      try {
        const { data: review, error: rErr } = await supabase
          .from("call_reviews")
          .insert({ profile_id: userId, title: entry.day.is_release ? `Release call — ${label}` : label, call_type: "roleplay", source: "homework", media_url: driveLink })
          .select("id, profile_id, media_path, media_url")
          .single();
        if (rErr) throw new Error(rErr.message);
        // Agents can't update their own submissions under RLS; link it privileged.
        await (await admin()).from("training_submissions").update({ review_id: review.id }).eq("id", sub.id);
        const { kickReviewProcessing } = await import("@/lib/coach.functions");
        await kickReviewProcessing(review);
      } catch (e) {
        console.warn("[training] call coach auto-analysis failed to start", e);
      }
    }

    if (entry.day.is_release) {
      if (a) await (await admin()).from("applicants").update({ release_requested_at: new Date().toISOString() }).eq("id", a.id);
      await log(a?.id, "release_requested", "Requested release call", { day: entry.day.slug }, userId);
    } else {
      await log(a?.id, "training_submitted", `Submitted training homework: ${label}`, { day: entry.day.slug }, userId);
    }
    if (a?.assigned_recruiter_id && a.assigned_recruiter_id !== userId) {
      await emailProfile(
        a.assigned_recruiter_id,
        "training-review-needed",
        { agent_name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim(), day_title: label, request_type: entry.day.is_release ? "release call recording" : "homework" },
        `${userId}-${data.dayId}-${Date.now()}`,
      );
    }
    return { ok: true };
  });

/* ----------------------------- Reviewer ---------------------------- */

export const listTrainingReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ filter: z.enum(["waiting", "release", "cleared"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.filter === "cleared") {
      const { data: rows } = await supabase
        .from("applicants")
        .select("id, first_name, last_name, email, cleared_to_call_at, release_passed_at")
        .not("cleared_to_call_at", "is", null)
        .order("cleared_to_call_at", { ascending: false })
        .limit(200);
      return { submissions: [] as any[], cleared: rows ?? [], counts: null };
    }
    const { data: days } = await supabase.from("training_days").select("id, title, day_label, is_release");
    const dayMap = new Map((days ?? []).map((d: any) => [d.id, d]));
    const wantRelease = data.filter === "release";
    const ids = (days ?? []).filter((d: any) => d.is_release === wantRelease).map((d: any) => d.id);
    if (!ids.length) return { submissions: [] as any[], cleared: [] as any[], counts: null };
    const { data: subs } = await supabase
      .from("training_submissions")
      .select("*")
      .eq("status", "submitted")
      .neq("profile_id", userId)
      .in("day_id", ids)
      .order("created_at", { ascending: true })
      .limit(200);
    const list = (subs ?? []) as TrainingSubmission[];
    await attachUrls(supabase, list);
    const pids = [...new Set(list.map((s) => s.profile_id))];
    const { data: names } = pids.length
      ? await supabase.rpc("profile_display_names", { _ids: pids })
      : { data: [] as any[] };
    const nameMap = new Map((names ?? []).map((n: any) => [n.id, n.name]));
    const sb = await admin();
    const { data: apps } = pids.length
      ? await sb.from("applicants").select("id, portal_profile_id").in("portal_profile_id", pids)
      : { data: [] as any[] };
    const appMap = new Map((apps ?? []).map((x: any) => [x.portal_profile_id, x.id]));
    const rids = list.map((s: any) => s.review_id).filter(Boolean);
    const { data: revs } = rids.length
      ? await supabase.from("call_reviews").select("id, status, overall, pillar_scores, improvements, media_path, media_url, transcript, transcript_text").in("id", rids)
      : { data: [] as any[] };
    const revMap = new Map<string, any>();
    for (const r of revs ?? []) {
      let audioUrl: string | null = null;
      if (r.media_path) audioUrl = (await supabase.storage.from("call-recordings").createSignedUrl(r.media_path, 60 * 60 * 6)).data?.signedUrl ?? null;
      revMap.set(r.id, { id: r.id, status: r.status, overall: r.overall, pillar_scores: r.pillar_scores, improvements: r.improvements, transcript: r.transcript, transcript_text: r.transcript_text, audioUrl });
    }
    const { data: past } = pids.length
      ? await supabase.from("training_submissions").select("profile_id, day_id, feedback, reviewed_at").eq("status", "redo").in("profile_id", pids).in("day_id", ids).order("reviewed_at", { ascending: false })
      : { data: [] as any[] };
    const { data: allSubs } = await supabase.from("training_submissions").select("day_id").eq("status", "submitted").neq("profile_id", userId);
    let waiting = 0, release = 0;
    for (const x of allSubs ?? []) (dayMap.get((x as any).day_id) as any)?.is_release ? release++ : waiting++;
    const driveId = (u: string | null) => (u ? (u.match(/drive\.google\.com\/file\/d\/([\w-]{10,})/)?.[1] ?? u.match(/[?&]id=([\w-]{10,})/)?.[1] ?? null) : null);
    return {
      counts: { waiting, release },
      submissions: list.map((s: any) => ({
        ...s,
        drive_file_id: driveId(s.link_url),
        call_review: s.review_id ? (revMap.get(s.review_id) ?? null) : null,
        prior_redos: (past ?? []).filter((p: any) => p.profile_id === s.profile_id && p.day_id === s.day_id),
        agent_name: (nameMap.get(s.profile_id) as string) ?? "Agent",
        applicant_id: (appMap.get(s.profile_id) as string) ?? null,
        day: dayMap.get(s.day_id) ?? null,
      })),
      cleared: [] as any[],
    };
  });

async function approveDay(sb: any, profileId: string, dayId: string, by: string, override: boolean) {
  const { error } = await sb
    .from("training_progress")
    .upsert(
      { profile_id: profileId, day_id: dayId, approved_at: new Date().toISOString(), approved_by: by, is_override: override },
      { onConflict: "profile_id,day_id" },
    );
  if (error) throw new Error(error.message);
}

async function markCleared(profileId: string, actor: string) {
  const a = await applicantForProfile(profileId);
  if (!a) return;
  const now = new Date().toISOString();
  const { applyStage } = await import("@/lib/recruiting/stage-engine.server");
  await applyStage({
    applicantId: a.id,
    stage: "active-agent",
    actorId: actor,
    reason: "release_passed",
    patch: { release_passed_at: now, cleared_to_call_at: now },
  });
  await log(a.id, "release_passed", "Passed release call — cleared to call", {}, actor);
  await emailProfile(profileId, "training-cleared-to-call", {}, `cleared-${profileId}`);
}

export const reviewSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ id: z.string().uuid(), decision: z.enum(["approve", "redo"]), feedback: z.string().max(4000).nullable().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.decision === "redo" && !data.feedback?.trim()) throw new Error("Add a note so the agent knows what to fix.");
    const { data: sub } = await supabase.from("training_submissions").select("*").eq("id", data.id).maybeSingle();
    if (!sub) throw new Error("Submission not found or you don't have access.");
    if (sub.profile_id === userId) throw new Error("You can't review your own training.");
    const { data: day } = await supabase.from("training_days").select("id, title, day_label, is_release").eq("id", sub.day_id).maybeSingle();
    if (!day) throw new Error("Training day not found.");

    const { error } = await supabase
      .from("training_submissions")
      .update({
        status: data.decision === "approve" ? "approved" : "redo",
        feedback: data.feedback ?? null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const a = await applicantForProfile(sub.profile_id);
    const label = `${day.day_label ?? ""} ${day.title}`.trim();
    if (data.decision === "approve") {
      await approveDay(supabase, sub.profile_id, day.id, userId, false);
      if (day.is_release) {
        await markCleared(sub.profile_id, userId);
      } else {
        await log(a?.id, "training_approved", `Training approved: ${label}`, { feedback: data.feedback }, userId);
        await emailProfile(sub.profile_id, "training-homework-approved", { day_title: label, feedback: data.feedback ?? "" }, `approved-${sub.id}`);
      }
    } else {
      await log(a?.id, day.is_release ? "release_not_yet" : "training_redo", day.is_release ? "Release call: not yet" : `Training sent back: ${label}`, { feedback: data.feedback }, userId);
      await emailProfile(sub.profile_id, "training-homework-redo", { day_title: label, feedback: data.feedback ?? "" }, `redo-${sub.id}`);
    }
    return { ok: true };
  });

/* ---------------------- Per-agent record + overrides ---------------------- */

async function visibleApplicant(sb: any, applicantId: string) {
  const { data } = await sb
    .from("applicants")
    .select("id, portal_profile_id, onboarding_completed_at, training_unlocked_at, release_requested_at, release_passed_at, cleared_to_call_at")
    .eq("id", applicantId)
    .maybeSingle();
  if (!data) throw new Error("Applicant not found or you don't have access.");
  return data;
}

export const getApplicantTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ applicantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const a = await visibleApplicant(context.supabase, data.applicantId);
    if (!a.portal_profile_id) return { hasAccount: false as const, applicant: a, track: [] as ReturnType<typeof computeTrack>, submissions: [] as TrainingSubmission[] };
    const unlocked = isUnlocked(a);
    const t = await loadTrack(context.supabase, a.portal_profile_id, true);
    return {
      hasAccount: true as const,
      applicant: { ...a, unlocked },
      track: computeTrack(t.days, t.progress, t.submissions, unlocked),
      submissions: t.submissions,
    };
  });

export const overrideTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        applicantId: z.string().uuid(),
        action: z.enum(["unlock", "lock", "approve_day", "unapprove_day", "pass_release"]),
        dayId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const a = await visibleApplicant(supabase, data.applicantId);
    if (!a.portal_profile_id) throw new Error("This person doesn't have a portal account yet.");
    if (a.portal_profile_id === userId) throw new Error("You can't change your own training.");
    const sb = await admin();
    const pid = a.portal_profile_id;

    if (data.action === "unlock" || data.action === "lock") {
      const unlock = data.action === "unlock";
      await sb
        .from("applicants")
        .update({ training_unlocked_at: unlock ? new Date().toISOString() : null, training_unlock_override_by: unlock ? userId : null })
        .eq("id", a.id);
      await log(a.id, unlock ? "training_unlocked" : "training_locked", unlock ? "Training unlocked manually" : "Manual training unlock removed", {}, userId);
    } else if (data.action === "approve_day" && data.dayId) {
      await approveDay(supabase, pid, data.dayId, userId, true);
      await log(a.id, "training_approved", "Training day approved manually", { day_id: data.dayId, override: true }, userId);
    } else if (data.action === "unapprove_day" && data.dayId) {
      const { error } = await supabase.from("training_progress").delete().eq("profile_id", pid).eq("day_id", data.dayId);
      if (error) throw new Error(error.message);
      await log(a.id, "training_unapproved", "Training day approval removed", { day_id: data.dayId }, userId);
    } else if (data.action === "pass_release") {
      const { data: rel } = await supabase.from("training_days").select("id").eq("is_release", true).limit(1).maybeSingle();
      if (rel) await approveDay(supabase, pid, rel.id, userId, true);
      await markCleared(pid, userId);
    }
    const { writeAudit } = await import("@/lib/audit");
    await writeAudit(supabase, { action: `training_${data.action}`, actor_id: userId, target_applicant_id: a.id, metadata: { day_id: data.dayId } });
    return { ok: true };
  });

/* ----------------------------- Content ----------------------------- */

export const listTrainingDaysAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManage(context.supabase, context.userId);
    const { data } = await context.supabase.from("training_days").select(DAY_COLS).order("position");
    return (data ?? []) as TrainingDay[];
  });

export const saveTrainingDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(200),
        day_label: z.string().max(40).nullable().optional(),
        position: z.number().int().min(0).max(1000),
        video_url: z.string().max(1000).nullable().optional(),
        objective: z.string().max(2000).nullable().optional(),
        prompt: z.string().max(20000).nullable().optional(),
        instructions: z.string().max(5000).nullable().optional(),
        checklist: z.array(z.string().max(300)).max(30).default([]),
        is_release: z.boolean().default(false),
        is_published: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase, context.userId);
    const { id, ...row } = data;
    const payload = { ...row, updated_at: new Date().toISOString() };
    if (id) {
      const { error } = await context.supabase.from("training_days").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const slug = `${row.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
    const { data: ins, error } = await context.supabase.from("training_days").insert({ ...payload, slug }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

/* ------------------------- Agent-by-agent review ------------------------- */

const driveFileId = (u: string | null) => (u ? (u.match(/drive\.google\.com\/file\/d\/([\w-]{10,})/)?.[1] ?? u.match(/[?&]id=([\w-]{10,})/)?.[1] ?? null) : null);

/** Every trainee who has submitted anything (RLS limits this to the caller's org), with waiting counts. */
export const listReviewAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: days }, { data: subs }] = await Promise.all([
      supabase.from("training_days").select("id, is_release"),
      supabase.from("training_submissions").select("profile_id, day_id, status, created_at").neq("profile_id", userId).order("created_at", { ascending: true }).limit(5000),
    ]);
    const rel = new Set((days ?? []).filter((d: any) => d.is_release).map((d: any) => d.id));
    const groups = new Map<string, { profile_id: string; waiting: number; release: number; attempts: number; approved: number; oldest: string; last: string }>();
    for (const s of (subs ?? []) as any[]) {
      const g = groups.get(s.profile_id) ?? { profile_id: s.profile_id, waiting: 0, release: 0, attempts: 0, approved: 0, oldest: "", last: s.created_at };
      g.attempts++;
      g.last = s.created_at;
      if (s.status === "approved") g.approved++;
      if (s.status === "submitted") {
        if (!g.oldest) g.oldest = s.created_at;
        if (rel.has(s.day_id)) g.release++; else g.waiting++;
      }
      groups.set(s.profile_id, g);
    }
    const ids = [...groups.keys()];
    const { data: names } = ids.length ? await supabase.rpc("profile_display_names", { _ids: ids }) : { data: [] as any[] };
    const nameMap = new Map((names ?? []).map((n: any) => [n.id, n.name]));
    return {
      agents: [...groups.values()]
        .map((g) => ({ ...g, name: (nameMap.get(g.profile_id) as string) ?? "Agent" }))
        .sort((a, b) => {
          const aw = a.waiting + a.release > 0, bw = b.waiting + b.release > 0;
          if (aw !== bw) return aw ? -1 : 1;
          return aw ? a.oldest.localeCompare(b.oldest) : b.last.localeCompare(a.last);
        }),
    };
  });

/** One agent's full training record for review: every day, every attempt, AI scores. */
export const getAgentTrainingReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.profileId === userId) throw new Error("You can't review your own training.");
    const a = await applicantForProfile(data.profileId);
    const t = await loadTrack(supabase, data.profileId, true);
    if (!t.submissions.length && a) {
      // Make sure the caller can actually see this agent before returning anything.
      const { data: vis } = await supabase.from("applicants").select("id").eq("id", a.id).maybeSingle();
      if (!vis) throw new Error("You don't have access to this agent.");
    }
    // Older submissions may not be linked to their Call Coach review; match by recording link.
    const unlinked = t.submissions.filter((s) => !s.review_id && s.link_url);
    if (unlinked.length) {
      const { data: byUrl } = await supabase.from("call_reviews").select("id, media_url").eq("profile_id", data.profileId).eq("source", "homework").limit(500);
      for (const s of unlinked) s.review_id = ((byUrl ?? []) as any[]).find((r) => r.media_url === s.link_url)?.id ?? null;
    }
    const rids = t.submissions.map((s) => s.review_id).filter((x): x is string => !!x);
    const { data: revs } = rids.length
      ? await supabase.from("call_reviews").select("id, status, overall, pillar_scores, improvements, summary, media_path, transcript, transcript_text").in("id", rids)
      : { data: [] as any[] };
    const revMap = new Map<string, any>();
    for (const r of (revs ?? []) as any[]) {
      const audioUrl = r.media_path ? (await supabase.storage.from("call-recordings").createSignedUrl(r.media_path, 60 * 60 * 6)).data?.signedUrl ?? null : null;
      revMap.set(r.id, { id: r.id, status: r.status, overall: r.overall, pillar_scores: r.pillar_scores, improvements: r.improvements, summary: r.summary, transcript: r.transcript, transcript_text: r.transcript_text, audioUrl });
    }
    const { data: names } = await supabase.rpc("profile_display_names", { _ids: [data.profileId] });
    const track = computeTrack(t.days, t.progress, t.submissions, isUnlocked(a));
    return {
      name: ((names ?? [])[0] as any)?.name ?? "Agent",
      applicantId: a?.id ?? null,
      clearedAt: a?.cleared_to_call_at ?? null,
      days: track.map((e) => ({
        day: e.day,
        state: e.state,
        attempts: t.submissions
          .filter((s) => s.day_id === e.day.id)
          .map((s: any) => ({ ...s, drive_file_id: driveFileId(s.link_url), call_review: s.review_id ? revMap.get(s.review_id) ?? null : null })),
      })),
    };
  });
