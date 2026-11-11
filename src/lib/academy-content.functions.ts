import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertCanManage } from "@/lib/academy/guard";

/* ============================================================ */
/* Presenters                                                    */
/* ============================================================ */

export const listPresenters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = context.supabase as any;
    const [{ data: presenters }, { data: staff }] = await Promise.all([
      s.from("presenters").select("*").order("sort_order").order("name"),
      s.from("profiles").select("id, full_name, avatar_url, email").eq("is_active", true).order("full_name"),
    ]);
    return { presenters: presenters ?? [], staff: staff ?? [] };
  });

export const upsertPresenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(160),
        role: z.string().trim().max(160).optional().or(z.literal("")),
        photo_url: z.string().trim().max(1000).optional().or(z.literal("")),
        profile_id: z.string().uuid().optional().nullable(),
        is_active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const initials =
      data.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]!.toUpperCase())
        .join("") || "V";
    const slugBase =
      data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "presenter";
    const patch: Record<string, unknown> = {
      name: data.name,
      role: data.role || null,
      photo_url: data.photo_url || null,
      profile_id: data.profile_id ?? null,
      is_external: !data.profile_id,
      initials,
      is_active: data.is_active ?? true,
    };
    if (data.id) {
      const { error } = await s.from("presenters").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    let slug = slugBase;
    for (let i = 2; i < 40; i++) {
      const { data: clash } = await s.from("presenters").select("id").eq("slug", slug).maybeSingle();
      if (!clash) break;
      slug = `${slugBase}-${i}`;
    }
    const { data: created, error } = await s
      .from("presenters")
      .insert({ ...patch, slug })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const deletePresenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any).from("presenters").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================ */
/* Recorded presentations — admin                                */
/* ============================================================ */

const recordingSchema = z.object({
  id: z.string().uuid().optional(),
  presenter_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  topic: z.string().trim().max(200).optional().or(z.literal("")),
  presenter_role: z.string().trim().max(160).optional().or(z.literal("")),
  description: z.string().max(6000).optional().or(z.literal("")),
  format: z.enum(["video", "audio"]),
  video_url: z.string().trim().max(2000).optional().or(z.literal("")),
  file_path: z.string().trim().max(500).optional().or(z.literal("")),
  thumbnail_url: z.string().trim().max(2000).optional().or(z.literal("")),
  duration: z.string().trim().max(40).optional().or(z.literal("")),
  recorded_on: z.string().trim().max(40).optional().or(z.literal("")),
  featured: z.boolean().optional(),
  is_new: z.boolean().optional(),
  status: z.enum(["draft", "published"]),
});

export const adminListRecordings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const [{ data: recordings }, { data: presenters }] = await Promise.all([
      s.from("recordings").select("*").order("recorded_on", { ascending: false }).order("created_at", { ascending: false }),
      s.from("presenters").select("*").order("name"),
    ]);
    const ids = (recordings ?? []).map((r: any) => r.id);
    const { data: transcripts } = ids.length
      ? await s
          .from("media_transcripts")
          .select("owner_id, status, notes_status")
          .eq("owner_type", "recording")
          .in("owner_id", ids)
      : { data: [] };
    const tByOwner: Record<string, any> = {};
    for (const t of transcripts ?? []) tByOwner[t.owner_id] = t;
    return {
      recordings: (recordings ?? []).map((r: any) => ({ ...r, transcript: tByOwner[r.id] ?? null })),
      presenters: presenters ?? [],
    };
  });

export const adminUpsertRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => recordingSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const patch: Record<string, unknown> = {
      presenter_id: data.presenter_id,
      title: data.title,
      topic: data.topic || null,
      presenter_role: data.presenter_role || null,
      description: data.description || null,
      format: data.format,
      video_url: data.video_url || null,
      file_path: data.file_path || null,
      thumbnail_url: data.thumbnail_url || null,
      duration: data.duration || null,
      recorded_on: data.recorded_on || null,
      featured: data.featured ?? false,
      is_new: data.is_new ?? false,
      status: data.status,
    };
    if (data.id) {
      const { error } = await s.from("recordings").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      const { autoQueueTranscription } = await import("@/lib/academy/auto-transcribe.server");
      await autoQueueTranscription(s, "recording", data.id, data.video_url);
      return { id: data.id };
    }
    const { data: created, error } = await s.from("recordings").insert(patch).select("id").single();
    if (error) throw new Error(error.message);
    const { autoQueueTranscription } = await import("@/lib/academy/auto-transcribe.server");
    await autoQueueTranscription(s, "recording", created.id, data.video_url);
    return { id: created.id as string };
  });

export const adminSetRecordingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "published"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any)
      .from("recordings")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDuplicateRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const { data: row } = await s.from("recordings").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Recording not found");
    const { id, slug, created_at, updated_at, ...rest } = row;
    const { data: created, error } = await s
      .from("recordings")
      .insert({ ...rest, title: `${row.title} (copy)`, slug: null, status: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const adminDeleteRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    await s.from("media_transcripts").delete().eq("owner_type", "recording").eq("owner_id", data.id);
    const { error } = await s.from("recordings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================ */
/* Library — admin (v2 fields)                                   */
/* ============================================================ */

export const LIBRARY_TYPES = [
  "pdf",
  "document",
  "guide",
  "playbook",
  "script",
  "worksheet",
  "link",
  "video",
  "audio",
  "image",
  "other",
] as const;

export const LIBRARY_CATEGORIES = [
  "Sales",
  "Systems",
  "Scripts",
  "Carrier Resources",
  "Leadership",
  "Agency Documents",
  "Tools",
] as const;

const librarySchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional().or(z.literal("")),
  type: z.enum(LIBRARY_TYPES),
  url: z.string().trim().max(2000).optional().or(z.literal("")),
  file_path: z.string().trim().max(500).optional().or(z.literal("")),
  thumbnail_url: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  duration: z.string().trim().max(40).optional().or(z.literal("")),
  is_required: z.boolean().optional(),
  featured: z.boolean().optional(),
  is_new: z.boolean().optional(),
  status: z.enum(["draft", "published"]),
});

export const adminListLibraryV2 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const { data: resources } = await s
      .from("library_resources")
      .select("*")
      .order("created_at", { ascending: false });
    const mediaIds = (resources ?? []).filter((r: any) => r.type === "video" || r.type === "audio").map((r: any) => r.id);
    const { data: transcripts } = mediaIds.length
      ? await s
          .from("media_transcripts")
          .select("owner_id, status, notes_status")
          .eq("owner_type", "library")
          .in("owner_id", mediaIds)
      : { data: [] };
    const tByOwner: Record<string, any> = {};
    for (const t of transcripts ?? []) tByOwner[t.owner_id] = t;
    return {
      resources: (resources ?? []).map((r: any) => ({ ...r, transcript: tByOwner[r.id] ?? null })),
    };
  });

export const adminUpsertLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => librarySchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const patch: Record<string, unknown> = {
      title: data.title,
      description: data.description || null,
      type: data.type,
      url: data.url || null,
      file_path: data.file_path || null,
      thumbnail_url: data.thumbnail_url || null,
      category: data.category || null,
      duration: data.duration || null,
      media_type: data.type === "video" ? "video" : data.type === "audio" ? "audio" : null,
      is_required: data.is_required ?? false,
      featured: data.featured ?? false,
      is_new: data.is_new ?? false,
      status: data.status,
      section: "library",
    };
    if (data.id) {
      const { error } = await s.from("library_resources").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      if (patch.media_type) {
        const { autoQueueTranscription } = await import("@/lib/academy/auto-transcribe.server");
        await autoQueueTranscription(s, "library", data.id, data.url);
      }
      return { id: data.id };
    }
    const { data: created, error } = await s.from("library_resources").insert(patch).select("id").single();
    if (error) throw new Error(error.message);
    if (patch.media_type) {
      const { autoQueueTranscription } = await import("@/lib/academy/auto-transcribe.server");
      await autoQueueTranscription(s, "library", created.id, data.url);
    }
    return { id: created.id as string };
  });

export const adminSetLibraryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "published"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any)
      .from("library_resources")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================ */
/* Uploads                                                       */
/* ============================================================ */

/** Long-lived signed URL for a private Academy storage object. */
export const signAcademyPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().trim().min(1).max(500) }).parse(d))
  .handler(async ({ context, data }) => {
    const s = context.supabase as any;
    const { data: signed, error } = await s.storage
      .from("academy")
      .createSignedUrl(data.path, 60 * 60 * 24 * 365 * 10);
    if (error || !signed?.signedUrl) throw new Error("Couldn't create a link for that file.");
    return { url: signed.signedUrl as string };
  });

/* ============================================================ */
/* Learner: recorded presentations                               */
/* ============================================================ */

export const listRecordingsLearner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = context.supabase as any;
    const [{ data: recordings }, { data: presenters }] = await Promise.all([
      s
        .from("recordings")
        .select("*")
        .eq("status", "published")
        .order("recorded_on", { ascending: false })
        .order("created_at", { ascending: false }),
      s.from("presenters").select("id, slug, name, role, initials, photo_url"),
    ]);
    const byId: Record<string, any> = {};
    for (const p of presenters ?? []) byId[p.id] = p;
    return {
      recordings: (recordings ?? []).map((r: any) => ({ ...r, presenter: byId[r.presenter_id] ?? null })),
    };
  });

export const getRecordingLearner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ context, data }) => {
    const s = context.supabase as any;
    const { data: rec } = await s.from("recordings").select("*").eq("slug", data.slug).maybeSingle();
    if (!rec) return { found: false as const };
    const [{ data: presenter }, { data: transcript }] = await Promise.all([
      s.from("presenters").select("id, slug, name, role, initials, photo_url").eq("id", rec.presenter_id).maybeSingle(),
      s
        .from("media_transcripts")
        .select("transcript_text, transcript_segments, speaker_names, notes, status, notes_status")
        .eq("owner_type", "recording")
        .eq("owner_id", rec.id)
        .maybeSingle(),
    ]);
    return { found: true as const, recording: { ...rec, presenter: presenter ?? null }, transcript: transcript ?? null };
  });

/* ============================================================ */
/* Admin hub counts                                              */
/* ============================================================ */

export const getAcademyAdminSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const [{ data: recs }, { data: lib }, { data: courses }] = await Promise.all([
      s.from("recordings").select("id, title, status, created_at").order("created_at", { ascending: false }),
      s.from("library_resources").select("id, title, status, created_at").order("created_at", { ascending: false }),
      s.from("courses").select("id, title, status, created_at").order("created_at", { ascending: false }),
    ]);
    const summarize = (rows: any[]) => ({
      published: rows.filter((r) => r.status === "published").length,
      drafts: rows.filter((r) => r.status !== "published").length,
      recent: rows.slice(0, 3).map((r) => ({ id: r.id, title: r.title, status: r.status })),
    });
    return {
      recordings: summarize(recs ?? []),
      library: summarize(lib ?? []),
      courses: summarize(courses ?? []),
    };
  });
