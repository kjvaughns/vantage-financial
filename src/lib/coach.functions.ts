/**
 * Call Coach: agents submit calls, AssemblyAI transcribes, AI scores them
 * against the stored Gold Standard (scripts + reference calls). Processing is
 * advanced step-by-step by client polling (`advanceReview`) so no single
 * request runs long on the worker.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PILLARS, overallScore, type PillarScores } from "@/lib/coach-scoring";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_admin", { _user_id: userId });
  if (!data) throw new Error("Forbidden: admins only.");
}

/** Turn a Google Drive file share link into a direct download URL. */
function directMediaUrl(url: string): string {
  const id = url.match(/drive\.google\.com\/file\/d\/([\w-]{10,})/)?.[1] ?? url.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([\w-]{10,})/)?.[1];
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : url;
}

async function mediaFor(row: { media_path: string | null; media_url: string | null }): Promise<string> {
  if (row.media_path) {
    const sb = await admin();
    const { data, error } = await sb.storage.from("call-recordings").createSignedUrl(row.media_path, 60 * 60 * 6);
    if (error || !data?.signedUrl) throw new Error("Couldn't access the uploaded recording.");
    return data.signedUrl;
  }
  if (row.media_url) return directMediaUrl(row.media_url);
  throw new Error("This call has no recording attached.");
}

/** Start processing a queued review: submit transcription and move it to transcribing.
 *  Exported so training homework submissions can kick off analysis immediately. */
export async function kickReviewProcessing(row: { id: string; media_path: string | null; media_url: string | null }) {
  const sb = await admin();
  const tx = await import("@/lib/academy/transcribe.server");
  const jobId = await tx.submitTranscription(await mediaFor(row));
  await sb.from("call_reviews").update({ status: "transcribing", provider_job_id: jobId, error: null, updated_at: new Date().toISOString() }).eq("id", row.id);
}

const mediaInput = z
  .object({
    title: z.string().trim().min(1).max(160),
    mediaPath: z.string().max(400).nullable().optional(),
    mediaUrl: z.string().url().max(2000).nullable().optional(),
  })
  .refine((d) => !!d.mediaPath !== !!d.mediaUrl, "Attach either an uploaded file or a Google Drive link.");

// --------------------------------------------------------------------------
// Agent-facing
// --------------------------------------------------------------------------

export const createCallReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => mediaInput.and(z.object({ callType: z.enum(["roleplay", "live"]) })).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.mediaPath && !data.mediaPath.startsWith(`${userId}/`)) throw new Error("Invalid upload.");
    if (data.mediaUrl && !/^https:\/\/(drive|docs)\.google\.com\//.test(data.mediaUrl)) {
      throw new Error("Paste a Google Drive file link, or upload the audio file instead.");
    }
    const { data: row, error } = await supabase
      .from("call_reviews")
      .insert({
        profile_id: userId,
        title: data.title,
        call_type: data.callType,
        source: data.mediaPath ? "upload" : "drive",
        media_path: data.mediaPath ?? null,
        media_url: data.mediaUrl ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const advanceReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS confirms the caller may see this review before we act with admin rights.
    const { data: row } = await context.supabase.from("call_reviews").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Call not found.");
    const sb = await admin();
    const fail = async (msg: string) => {
      await sb.from("call_reviews").update({ status: "failed", error: msg, updated_at: new Date().toISOString() }).eq("id", row.id);
      return { status: "failed" as const, error: msg };
    };
    const tx = await import("@/lib/academy/transcribe.server");
    try {
      if (row.status === "queued") {
        await kickReviewProcessing(row);
        return { status: "transcribing" as const };
      }
      if (row.status === "transcribing") {
        const t = await tx.fetchTranscription(row.provider_job_id!);
        if (t.status === "failed") return fail(t.error ?? "Transcription failed.");
        if (t.status !== "completed") return { status: "transcribing" as const };
        await sb
          .from("call_reviews")
          .update({ status: "scoring", transcript_text: t.text, transcript: { segments: t.segments ?? [], sections: [] }, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        return { status: "scoring" as const };
      }
      if (row.status === "scoring") {
        // Claim the job so concurrent polls don't score twice.
        const { data: claimed } = await sb
          .from("call_reviews")
          .update({ status: "analyzing", updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("status", "scoring")
          .select("id");
        if (!claimed?.length) return { status: "analyzing" as const };
        const result = await runScoring(sb, row);
        return { status: "done" as const, overall: result };
      }
      if (row.status === "analyzing") {
        // Recover a stuck analysis after 3 minutes.
        if (Date.now() - new Date(row.updated_at).getTime() > 180_000) {
          await sb.from("call_reviews").update({ status: "scoring", updated_at: new Date().toISOString() }).eq("id", row.id);
        }
        return { status: "analyzing" as const };
      }
      return { status: row.status as string };
    } catch (e) {
      return fail((e as Error).message);
    }
  });

async function runScoring(sb: any, row: any) {
  const { scoreCall, timedTranscript } = await import("@/lib/coach.server");
  const [{ data: scripts }, { data: refs }, { data: settings }] = await Promise.all([
    sb.from("coach_reference_scripts").select("title, content").eq("is_active", true),
    sb.from("coach_reference_calls").select("title, transcript_text").eq("is_active", true).eq("status", "done").limit(3),
    sb.from("coach_settings").select("*").eq("id", true).maybeSingle(),
  ]);
  const segs = (row.transcript?.segments ?? []) as { start: number; text: string; speaker?: string | null }[];
  const result = await scoreCall({
    transcript: segs.length ? timedTranscript(segs) : row.transcript_text ?? "",
    scripts: (scripts ?? []).map((s: any) => ({ title: s.title, content: s.content })),
    references: (refs ?? []).map((r: any) => ({ title: r.title, transcript: r.transcript_text ?? "" })),
    rubricNotes: (settings?.rubric_notes ?? {}) as Record<string, string>,
    callType: row.call_type,
  });
  const overall = overallScore(result.pillars, (settings?.weights ?? {}) as Record<string, number>);
  await sb
    .from("call_reviews")
    .update({
      status: "done",
      pillar_scores: result.pillars,
      overall,
      summary: result.summary,
      improvements: result.improvements,
      transcript: { segments: segs, sections: result.sections },
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  return overall;
}

export const retryReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("call_reviews").select("id, profile_id, status, transcript_text").eq("id", data.id).maybeSingle();
    if (!row || row.profile_id !== context.userId) throw new Error("Call not found.");
    const sb = await admin();
    await sb.from("call_reviews").update({ status: row.transcript_text ? "scoring" : "queued", error: null, updated_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: true };
  });

/** Re-run AI scoring on an already-scored (or failed) call using the current Gold Standard.
 *  Anyone who can read the review (owner, upline, admin) may re-analyze; the transcript is kept. */
export const reanalyzeReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("call_reviews").select("id, status, transcript_text").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Call not found.");
    if (row.status !== "done" && row.status !== "failed") throw new Error("This call is still being processed.");
    const sb = await admin();
    const hasTranscript = !!row.transcript_text;
    await sb
      .from("call_reviews")
      .update({
        status: hasTranscript ? "scoring" : "queued",
        pillar_scores: null,
        overall: null,
        summary: null,
        improvements: null,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return { ok: true };
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("call_reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const LIST_COLS = "id, profile_id, title, call_type, source, status, overall, pillar_scores, error, created_at";

export const listMyReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("call_reviews").select(LIST_COLS).eq("profile_id", context.userId).order("created_at", { ascending: false }).limit(100);
    const rows = (data ?? []) as any[];
    const done = rows.filter((r) => r.status === "done");
    const avg: Record<string, number> = {};
    for (const p of PILLARS) {
      const vals = done.map((r) => r.pillar_scores?.[p.key]?.score).filter((n) => typeof n === "number");
      if (vals.length) avg[p.key] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    }
    const overallAvg = done.length ? Math.round(done.reduce((a, r) => a + (r.overall ?? 0), 0) / done.length) : null;
    return { reviews: rows, pillarAvg: avg, overallAvg };
  });

export const getReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("call_reviews").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Call not found.");
    const { data: comments } = await supabase.from("call_review_comments").select("*").eq("review_id", data.id).order("created_at");
    const ids = [...new Set([row.profile_id, ...(comments ?? []).map((c: any) => c.author_id)])];
    const { data: names } = await supabase.rpc("profile_display_names", { _ids: ids });
    const nameMap = new Map((names ?? []).map((n: any) => [n.id, n.name]));
    let audioUrl: string | null = null;
    if (row.media_path) {
      const { data: s } = await supabase.storage.from("call-recordings").createSignedUrl(row.media_path, 60 * 60);
      audioUrl = s?.signedUrl ?? null;
    }
    return {
      review: { ...row, pillar_scores: row.pillar_scores as PillarScores | null, agent_name: (nameMap.get(row.profile_id) as string) ?? "Agent" },
      comments: (comments ?? []).map((c: any) => ({ ...c, author_name: (nameMap.get(c.author_id) as string) ?? "Leader" })),
      audioUrl,
      isOwner: row.profile_id === userId,
    };
  });

export const addReviewComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("call_review_comments").insert({ review_id: data.id, author_id: context.userId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTeamCoaching = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("call_reviews").select(LIST_COLS).neq("profile_id", userId).order("created_at", { ascending: false }).limit(500);
    const rows = (data ?? []) as any[];
    const ids = [...new Set(rows.map((r) => r.profile_id))];
    const { data: names } = ids.length ? await supabase.rpc("profile_display_names", { _ids: ids }) : { data: [] as any[] };
    const nameMap = new Map((names ?? []).map((n: any) => [n.id, n.name]));
    const agents = ids.map((id) => {
      const mine = rows.filter((r) => r.profile_id === id);
      const done = mine.filter((r) => r.status === "done");
      const avg = done.length ? Math.round(done.reduce((a, r) => a + (r.overall ?? 0), 0) / done.length) : null;
      const pillarAvg: Record<string, number> = {};
      for (const p of PILLARS) {
        const v = done.map((r) => r.pillar_scores?.[p.key]?.score).filter((n) => typeof n === "number");
        if (v.length) pillarAvg[p.key] = v.reduce((a, b) => a + b, 0) / v.length;
      }
      const weakest = Object.entries(pillarAvg).sort((a, b) => a[1] - b[1])[0]?.[0] ?? null;
      return { profile_id: id, name: (nameMap.get(id) as string) ?? "Agent", calls: mine.length, avg, weakest, latest: mine[0] };
    });
    return { agents };
  });

// --------------------------------------------------------------------------
// Admin: Gold Standard
// --------------------------------------------------------------------------

export const getGoldStandard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [{ data: scripts }, { data: calls }, { data: settings }, { data: reviews }] = await Promise.all([
      context.supabase.from("coach_reference_scripts").select("*").order("created_at"),
      context.supabase.from("coach_reference_calls").select("id, title, status, error, is_active, media_path, media_url, source_review_id, created_at").order("created_at", { ascending: false }),
      context.supabase.from("coach_settings").select("*").eq("id", true).maybeSingle(),
      context.supabase.from("call_reviews").select("id, title, overall, call_type, created_at").eq("status", "done").not("transcript_text", "is", null).order("created_at", { ascending: false }).limit(30),
    ]);
    const promoted = new Set((calls ?? []).map((c: any) => c.source_review_id).filter(Boolean));
    return {
      scripts: scripts ?? [],
      calls: calls ?? [],
      settings: settings ?? { weights: {}, rubric_notes: {}, min_score_for_approval: null },
      candidates: (reviews ?? []).filter((r: any) => !promoted.has(r.id)),
    };
  });

export const syncScriptFromDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ docUrl: z.string().min(10).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const docId = data.docUrl.match(/\/document\/d\/([\w-]{20,})/)?.[1] ?? (/^[\w-]{20,}$/.test(data.docUrl) ? data.docUrl : null);
    if (!docId) throw new Error("Paste a Google Docs link.");
    const { fetchGoogleDocText } = await import("@/lib/coach.server");
    const doc = await fetchGoogleDocText(docId);
    const now = new Date().toISOString();
    const { data: existing } = await context.supabase.from("coach_reference_scripts").select("id").eq("source_doc_id", docId).maybeSingle();
    const payload = { title: doc.title, source_doc_id: docId, content: doc.text, synced_at: now, updated_at: now };
    const q = existing
      ? context.supabase.from("coach_reference_scripts").update(payload).eq("id", existing.id)
      : context.supabase.from("coach_reference_scripts").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { title: doc.title, chars: doc.text.length };
  });

export const saveScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid().optional(), title: z.string().trim().min(1).max(200), content: z.string().max(200000), isActive: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const payload = { title: data.title, content: data.content, is_active: data.isActive, updated_at: new Date().toISOString() };
    const { error } = data.id
      ? await context.supabase.from("coach_reference_scripts").update(payload).eq("id", data.id)
      : await context.supabase.from("coach_reference_scripts").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await context.supabase.from("coach_reference_scripts").delete().eq("id", data.id);
    return { ok: true };
  });

export const addReferenceCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => mediaInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("coach_reference_calls").insert({
      title: data.title,
      media_path: data.mediaPath ?? null,
      media_url: data.mediaUrl ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Turns an already-scored call (with its transcript) into a Gold Standard model call. */
export const promoteReviewToReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reviewId: z.string().uuid(), title: z.string().trim().max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: review } = await context.supabase
      .from("call_reviews")
      .select("id, title, transcript_text")
      .eq("id", data.reviewId)
      .eq("status", "done")
      .maybeSingle();
    if (!review?.transcript_text) throw new Error("That call doesn't have a finished transcript yet.");
    const { error } = await context.supabase.from("coach_reference_calls").insert({
      title: data.title?.trim() || review.title,
      transcript_text: review.transcript_text,
      status: "done",
      source_review_id: review.id,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const advanceReferenceCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row } = await context.supabase.from("coach_reference_calls").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Not found.");
    const tx = await import("@/lib/academy/transcribe.server");
    const upd = (v: Record<string, unknown>) => context.supabase.from("coach_reference_calls").update({ ...v, updated_at: new Date().toISOString() }).eq("id", row.id);
    try {
      if (row.status === "queued") {
        const jobId = await tx.submitTranscription(await mediaFor(row));
        await upd({ status: "transcribing", provider_job_id: jobId, error: null });
        return { status: "transcribing" };
      }
      if (row.status === "transcribing") {
        const t = await tx.fetchTranscription(row.provider_job_id!);
        if (t.status === "failed") {
          await upd({ status: "failed", error: t.error ?? "Transcription failed." });
          return { status: "failed" };
        }
        if (t.status !== "completed") return { status: "transcribing" };
        const { timedTranscript } = await import("@/lib/coach.server");
        await upd({ status: "done", transcript_text: t.segments?.length ? timedTranscript(t.segments) : t.text });
        return { status: "done" };
      }
      return { status: row.status };
    } catch (e) {
      await upd({ status: "failed", error: (e as Error).message });
      return { status: "failed" };
    }
  });

export const updateReferenceCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), isActive: z.boolean().optional(), remove: z.boolean().optional(), retry: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const t = context.supabase.from("coach_reference_calls");
    if (data.remove) await t.delete().eq("id", data.id);
    else if (data.retry) await t.update({ status: "queued", error: null }).eq("id", data.id);
    else if (data.isActive !== undefined) await t.update({ is_active: data.isActive }).eq("id", data.id);
    return { ok: true };
  });

export const saveCoachSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        weights: z.record(z.string(), z.number().min(0).max(5)),
        rubricNotes: z.record(z.string(), z.string().max(1000)),
        minScore: z.number().int().min(0).max(100).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("coach_settings")
      .upsert({ id: true, weights: data.weights, rubric_notes: data.rubricNotes, min_score_for_approval: data.minScore, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
