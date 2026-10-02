import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Admins, or anyone granted can_manage_resources, may edit Academy content.
 *  Mirrors the SQL academy_can_manage() used by RLS. */
async function assertCanManage(supabase: any, userId: string) {
  const [{ data: roleRows }, { data: prof }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("can_manage_resources").eq("id", userId).maybeSingle(),
  ]);
  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  const isAdmin = roles.some((r: string) => r === "admin" || r === "super_admin");
  if (!isAdmin && !prof?.can_manage_resources) {
    throw new Error("Forbidden: you are not permitted to manage Academy content.");
  }
}

/* ============================================================ */
/* Courses                                                       */
/* ============================================================ */

export const adminListCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { data } = await (supabase as any)
      .from("courses")
      .select("id, slug, title, status, is_required, instructor_name, created_at")
      .order("created_at", { ascending: false });
    return { courses: data ?? [] };
  });

/** Full nested course tree for the editor. */
export const adminGetCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const { data: course } = await s.from("courses").select("*").eq("id", data.id).maybeSingle();
    if (!course) throw new Error("Course not found");
    const { data: modules } = await s
      .from("course_modules")
      .select("*")
      .eq("course_id", data.id)
      .order("position");
    const moduleIds = (modules ?? []).map((m: any) => m.id);
    const { data: lessons } = moduleIds.length
      ? await s.from("course_lessons").select("*").in("module_id", moduleIds).order("position")
      : { data: [] };
    const quizIds = (lessons ?? []).filter((l: any) => l.kind === "quiz").map((l: any) => l.id);
    const { data: questions } = quizIds.length
      ? await s.from("quiz_questions").select("*").in("lesson_id", quizIds).order("position")
      : { data: [] };
    return { course, modules: modules ?? [], lessons: lessons ?? [], questions: questions ?? [] };
  });

export const adminUpsertCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(200),
        slug: z.string().trim().max(200).optional().or(z.literal("")),
        description: z.string().max(1000).optional().or(z.literal("")),
        long_description: z.string().max(6000).optional().or(z.literal("")),
        instructor_name: z.string().max(160).optional().or(z.literal("")),
        instructor_role: z.string().max(160).optional().or(z.literal("")),
        thumbnail_url: z.string().trim().max(2000).optional().or(z.literal("")),
        outcomes: z.array(z.string().trim().max(300)).max(20).optional(),
        is_required: z.boolean().optional(),
        status: z.enum(["draft", "published"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const patch: Record<string, unknown> = {
      title: data.title,
      description: data.description || null,
      long_description: data.long_description || null,
      instructor_name: data.instructor_name || null,
      instructor_role: data.instructor_role || null,
      thumbnail_url: data.thumbnail_url || null,
      outcomes: (data.outcomes ?? []).filter(Boolean),
      is_required: data.is_required ?? false,
      status: data.status ?? "draft",
    };
    if (data.slug) patch.slug = data.slug; // else the trigger auto-generates
    if (data.id) {
      const { error } = await s.from("courses").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await s.from("courses").insert(patch).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });


export const adminDeleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any).from("courses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================ */
/* Modules / lessons / questions                                 */
/* ============================================================ */

export const adminUpsertModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        course_id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        position: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    if (data.id) {
      const { error } = await s
        .from("course_modules")
        .update({ title: data.title })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { count } = await s
      .from("course_modules")
      .select("id", { count: "exact", head: true })
      .eq("course_id", data.course_id);
    const { data: created, error } = await s
      .from("course_modules")
      .insert({ course_id: data.course_id, title: data.title, position: count ?? 0 })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const adminUpsertLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        module_id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        kind: z.enum(["video", "audio", "text", "resource", "link", "quiz"]),
        video_url: z.string().trim().max(2000).optional().or(z.literal("")),
        duration: z.string().trim().max(40).optional().or(z.literal("")),
        blurb: z.string().max(4000).optional().or(z.literal("")),
        body: z.string().max(40000).optional().or(z.literal("")),
        resource_url: z.string().trim().max(2000).optional().or(z.literal("")),
        resource_label: z.string().trim().max(200).optional().or(z.literal("")),
        file_path: z.string().trim().max(500).optional().or(z.literal("")),
        reference_links: z
          .array(
            z.object({
              label: z.string().trim().min(1).max(200),
              kind: z.enum(["external", "internal"]),
              url: z.string().trim().min(1).max(2000),
              note: z.string().trim().max(300).optional().or(z.literal("")),
            }),
          )
          .max(20)
          .optional(),
        is_published: z.boolean().optional(),
        quiz_pass_threshold: z.number().min(0).max(1).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const isMedia = data.kind === "video" || data.kind === "audio";
    const patch: Record<string, unknown> = {
      title: data.title,
      kind: data.kind,
      media_type: isMedia ? data.kind : null,
      video_url: isMedia ? data.video_url || null : null,
      duration: data.duration || null,
      blurb: data.blurb || null,
      body: data.kind === "text" ? data.body || null : null,
      resource_url: data.kind === "resource" || data.kind === "link" ? data.resource_url || null : null,
      resource_label: data.resource_label || null,
      file_path: data.file_path || null,
      ...(data.reference_links ? { reference_links: normalizeRefLinks(data.reference_links) } : {}),
      is_published: data.is_published ?? true,
      quiz_pass_threshold: data.quiz_pass_threshold ?? 0.75,
    };
    if (data.id) {
      const { error } = await s.from("course_lessons").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { count } = await s
      .from("course_lessons")
      .select("id", { count: "exact", head: true })
      .eq("module_id", data.module_id);
    const { data: created, error } = await s
      .from("course_lessons")
      .insert({ module_id: data.module_id, position: count ?? 0, ...patch })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

/** Duplicate a lesson (and its quiz questions) inside the same module. */
export const adminDuplicateLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const { data: row } = await s.from("course_lessons").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Lesson not found");
    const { id, created_at, ...rest } = row as any;
    const { data: created, error } = await s
      .from("course_lessons")
      .insert({ ...rest, title: `${row.title} (copy)`, position: (row.position ?? 0) + 1, is_published: false })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { data: qs } = await s.from("quiz_questions").select("*").eq("lesson_id", data.id).order("position");
    if ((qs ?? []).length) {
      await s.from("quiz_questions").insert(
        (qs ?? []).map((q: any) => {
          const { id: _qid, ...qr } = q;
          return { ...qr, lesson_id: created.id };
        }),
      );
    }
    return { id: created.id as string };
  });

export const adminSetLessonPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), is_published: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any)
      .from("course_lessons")
      .update({ is_published: data.is_published })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpsertQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        lesson_id: z.string().uuid(),
        question_text: z.string().trim().min(1).max(1000),
        options: z.array(z.string().max(400)).min(2).max(6),
        correct_index: z.number().int().min(0),
        explanation: z.string().max(2000).optional().or(z.literal("")),
        position: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const patch = {
      question_text: data.question_text,
      options: data.options,
      correct_index: Math.min(data.correct_index, data.options.length - 1),
      explanation: data.explanation || null,
    };

    if (data.id) {
      const { error } = await s.from("quiz_questions").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { count } = await s
      .from("quiz_questions")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", data.lesson_id);
    const { data: created, error } = await s
      .from("quiz_questions")
      .insert({ lesson_id: data.lesson_id, position: count ?? 0, ...patch })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

/** Delete any Academy child row (module/lesson/question). */
export const adminDeleteNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["module", "lesson", "question"]),
        id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const table =
      data.kind === "module"
        ? "course_modules"
        : data.kind === "lesson"
          ? "course_lessons"
          : "quiz_questions";
    const { error } = await (supabase as any).from(table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Persist a new order for modules / lessons / questions (position = index). */
export const adminReorder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["module", "lesson", "question"]),
        ids: z.array(z.string().uuid()).max(200),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const table =
      data.kind === "module"
        ? "course_modules"
        : data.kind === "lesson"
          ? "course_lessons"
          : "quiz_questions";
    const s = supabase as any;
    await Promise.all(
      data.ids.map((id, i) => s.from(table).update({ position: i }).eq("id", id)),
    );
    return { ok: true };
  });

/* ============================================================ */
/* Library                                                       */
/* ============================================================ */

export const adminListLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const [{ data: resources }, { data: joins }, { data: tags }] = await Promise.all([
      s.from("library_resources").select("*").order("created_at", { ascending: false }),
      s.from("library_resource_tags").select("resource_id, tag_id"),
      s.from("library_tags").select("id, name").order("name"),
    ]);
    const tagName: Record<string, string> = {};
    for (const t of tags ?? []) tagName[t.id] = t.name;
    const byResource: Record<string, string[]> = {};
    for (const j of joins ?? []) (byResource[j.resource_id] ??= []).push(tagName[j.tag_id]);
    return {
      resources: (resources ?? []).map((r: any) => ({ ...r, tags: byResource[r.id] ?? [] })),
      tags: tags ?? [],
    };
  });

export const adminUpsertResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(200),
        slug: z.string().trim().max(200).optional().or(z.literal("")),
        description: z.string().max(2000).optional().or(z.literal("")),
        type: z.enum(["file", "video", "audio", "link"]),
        url: z.string().trim().max(1000).optional().or(z.literal("")),
        is_required: z.boolean().optional(),
        section: z.enum(["library", "presentation"]).optional(),
        category: z.string().trim().max(80).optional().or(z.literal("")),
        tags: z.array(z.string().trim().max(60)).max(20).optional().default([]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const patch: Record<string, unknown> = {
      title: data.title,
      description: data.description || null,
      type: data.type,
      url: data.url || null,
      is_required: data.is_required ?? false,
      section: data.section ?? "library",
      category: data.category || null,
    };
    if (data.slug) patch.slug = data.slug;

    let resourceId = data.id;
    if (resourceId) {
      const { error } = await s.from("library_resources").update(patch).eq("id", resourceId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await s
        .from("library_resources")
        .insert(patch)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      resourceId = created.id as string;
    }

    // Sync tags: ensure each exists, then replace the join set.
    const names = Array.from(new Set((data.tags ?? []).map((t) => t.trim()).filter(Boolean)));
    const tagIds: string[] = [];
    for (const name of names) {
      await s.from("library_tags").upsert({ name }, { onConflict: "name" });
      const { data: tag } = await s.from("library_tags").select("id").eq("name", name).maybeSingle();
      if (tag?.id) tagIds.push(tag.id);
    }
    await s.from("library_resource_tags").delete().eq("resource_id", resourceId);
    if (tagIds.length) {
      await s
        .from("library_resource_tags")
        .insert(tagIds.map((tag_id) => ({ resource_id: resourceId, tag_id })));
    }
    return { id: resourceId as string };
  });

export const adminDeleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any).from("library_resources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRenameTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any)
      .from("library_tags")
      .update({ name: data.name })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any).from("library_tags").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================ */
/* Learner: Academy home + library                               */
/* ============================================================ */

/** Published courses (with the caller's progress) + all library resources
 *  (with tags) + the tag set, for the Academy home. */
export const getAcademyHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const s = supabase as any;
    const [{ data: courses }, { data: resources }, { data: joins }, { data: tags }, { data: enrollments }] =
      await Promise.all([
        s.from("courses").select("*").eq("status", "published").order("created_at", { ascending: false }),
        s.from("library_resources").select("*").order("created_at", { ascending: false }),
        s.from("library_resource_tags").select("resource_id, tag_id"),
        s.from("library_tags").select("id, name").order("name"),
        s.from("enrollments").select("id, course_id, completed_at").eq("user_id", userId),
      ]);

    const courseIds = (courses ?? []).map((c: any) => c.id);
    const { data: modules } = courseIds.length
      ? await s.from("course_modules").select("id, course_id").in("course_id", courseIds)
      : { data: [] };
    const modToCourse: Record<string, string> = {};
    const modIds: string[] = [];
    for (const m of modules ?? []) { modToCourse[m.id] = m.course_id; modIds.push(m.id); }
    const { data: lessons } = modIds.length
      ? await s.from("course_lessons").select("id, module_id").in("module_id", modIds)
      : { data: [] };
    const totalByCourse: Record<string, number> = {};
    for (const l of lessons ?? []) {
      const cid = modToCourse[l.module_id];
      if (cid) totalByCourse[cid] = (totalByCourse[cid] ?? 0) + 1;
    }
    const enrByCourse: Record<string, any> = {};
    const enrCourse: Record<string, string> = {};
    for (const e of enrollments ?? []) { enrByCourse[e.course_id] = e; enrCourse[e.id] = e.course_id; }
    const enrIds = (enrollments ?? []).map((e: any) => e.id);
    const { data: progress } = enrIds.length
      ? await s.from("lesson_progress").select("enrollment_id, completed_at").in("enrollment_id", enrIds)
      : { data: [] };
    const completedByCourse: Record<string, number> = {};
    for (const p of progress ?? []) {
      if (p.completed_at) {
        const cid = enrCourse[p.enrollment_id];
        if (cid) completedByCourse[cid] = (completedByCourse[cid] ?? 0) + 1;
      }
    }

    const courseCards = (courses ?? []).map((c: any) => {
      const total = totalByCourse[c.id] ?? 0;
      const done = completedByCourse[c.id] ?? 0;
      const enrolled = !!enrByCourse[c.id];
      return {
        ...c,
        progress: enrolled ? (total ? Math.round((done / total) * 100) : 0) : null,
        completed: !!enrByCourse[c.id]?.completed_at,
      };
    });

    const tagName: Record<string, string> = {};
    for (const t of tags ?? []) tagName[t.id] = t.name;
    const byResource: Record<string, string[]> = {};
    for (const j of joins ?? []) (byResource[j.resource_id] ??= []).push(tagName[j.tag_id]);
    const resourceCards = (resources ?? []).map((r: any) => ({ ...r, tags: byResource[r.id] ?? [] }));

    const { count: recordingCount } = await s
      .from("recordings")
      .select("id", { count: "exact", head: true })
      .eq("status", "published");

    return {
      courses: courseCards,
      resources: resourceCards,
      tags: (tags ?? []).map((t: any) => t.name),
      recordingCount: recordingCount ?? 0,
    };
  });


export const getLibraryResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ context, data }) => {
    const s = context.supabase as any;
    const { data: r } = await s.from("library_resources").select("*").eq("slug", data.slug).maybeSingle();
    if (!r) return { found: false as const };
    const { data: joins } = await s.from("library_resource_tags").select("tag_id").eq("resource_id", r.id);
    const tagIds = (joins ?? []).map((j: any) => j.tag_id);
    const { data: tags } = tagIds.length
      ? await s.from("library_tags").select("name").in("id", tagIds)
      : { data: [] };
    return { found: true as const, resource: { ...r, tags: (tags ?? []).map((t: any) => t.name) } };
  });

/* ============================================================ */
/* Learner: course player                                        */
/* ============================================================ */

async function resolveEnrollment(s: any, userId: string, courseId: string): Promise<string> {
  const { data: existing } = await s
    .from("enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await s
    .from("enrollments")
    .insert({ course_id: courseId, user_id: userId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

/** After any progress change, stamp/clear completion + final score. */
async function recomputeCompletion(s: any, enrollmentId: string, courseId: string) {
  const { data: mods } = await s.from("course_modules").select("id").eq("course_id", courseId);
  const modIds = (mods ?? []).map((m: any) => m.id);
  const { data: lessons } = modIds.length
    ? await s.from("course_lessons").select("id").in("module_id", modIds)
    : { data: [] };
  const lessonIds = (lessons ?? []).map((l: any) => l.id);
  const { data: prog } = await s
    .from("lesson_progress")
    .select("lesson_id, completed_at, quiz_score")
    .eq("enrollment_id", enrollmentId);
  const completed = new Set((prog ?? []).filter((p: any) => p.completed_at).map((p: any) => p.lesson_id));
  const allDone = lessonIds.length > 0 && lessonIds.every((id: string) => completed.has(id));
  const { data: enr } = await s.from("enrollments").select("completed_at").eq("id", enrollmentId).maybeSingle();
  if (allDone && !enr?.completed_at) {
    const scores = (prog ?? []).filter((p: any) => p.quiz_score != null).map((p: any) => Number(p.quiz_score));
    const final = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null;
    await s.from("enrollments").update({ completed_at: new Date().toISOString(), final_score: final }).eq("id", enrollmentId);
    // Finishing the Vantage Closer Course auto-completes that onboarding step.
    try {
      const { data: c } = await s.from("courses").select("slug").eq("id", courseId).maybeSingle();
      if (c?.slug === "vantage-closer") {
        await s.rpc("update_onboarding", { _step: "complete_vantage_closer_course" });
      }
    } catch {
      /* best-effort */
    }
  } else if (!allDone && enr?.completed_at) {
    await s.from("enrollments").update({ completed_at: null, final_score: null }).eq("id", enrollmentId);
  }
}

/** Resolve a published course by slug, auto-enroll the caller, and return the
 *  full tree + the caller's progress. Quiz answers (correct_index) are never
 *  sent to the client — scoring happens server-side. */
export const getCourseLearner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const s = supabase as any;
    const { data: course } = await s.from("courses").select("*").eq("slug", data.slug).maybeSingle();
    if (!course) return { found: false as const };

    const enrollmentId = await resolveEnrollment(s, userId, course.id);
    const { data: modules } = await s
      .from("course_modules")
      .select("*")
      .eq("course_id", course.id)
      .order("position");
    const modIds = (modules ?? []).map((m: any) => m.id);
    const { data: allLessons } = modIds.length
      ? await s.from("course_lessons").select("*").in("module_id", modIds).order("position")
      : { data: [] };
    const lessons = (allLessons ?? []).filter((l: any) => l.is_published !== false);
    const quizIds = lessons.filter((l: any) => l.kind === "quiz").map((l: any) => l.id);
    const { data: questions } = quizIds.length
      ? await s.from("quiz_questions").select("id, lesson_id, question_text, options, position").in("lesson_id", quizIds).order("position")
      : { data: [] };
    const mediaIds = lessons.filter((l: any) => l.kind === "video" || l.kind === "audio").map((l: any) => l.id);
    const { data: transcripts } = mediaIds.length
      ? await s
          .from("media_transcripts")
          .select("owner_id, transcript_text, transcript_segments, speaker_names, notes, status, notes_status")
          .eq("owner_type", "lesson")
          .in("owner_id", mediaIds)
      : { data: [] };

    const { data: progress } = await s
      .from("lesson_progress")
      .select("lesson_id, completed_at, quiz_score")
      .eq("enrollment_id", enrollmentId);
    const { data: enrollment } = await s.from("enrollments").select("*").eq("id", enrollmentId).maybeSingle();

    return {
      found: true as const,
      course,
      modules: modules ?? [],
      lessons: lessons ?? [],
      questions: questions ?? [], // no correct_index
      transcripts: transcripts ?? [],
      progress: progress ?? [],
      enrollment,
    };

  });

async function lessonCourseId(s: any, lessonId: string): Promise<{ courseId: string; threshold: number } | null> {
  const { data: lesson } = await s
    .from("course_lessons")
    .select("id, module_id, quiz_pass_threshold")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return null;
  const { data: mod } = await s.from("course_modules").select("course_id").eq("id", lesson.module_id).maybeSingle();
  if (!mod) return null;
  return { courseId: mod.course_id, threshold: Number(lesson.quiz_pass_threshold ?? 0.75) };
}

export const markLessonComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lesson_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const s = supabase as any;
    const info = await lessonCourseId(s, data.lesson_id);
    if (!info) throw new Error("Lesson not found");
    const enrollmentId = await resolveEnrollment(s, userId, info.courseId);
    await s
      .from("lesson_progress")
      .upsert(
        { enrollment_id: enrollmentId, lesson_id: data.lesson_id, completed_at: new Date().toISOString() },
        { onConflict: "enrollment_id,lesson_id" },
      );
    await recomputeCompletion(s, enrollmentId, info.courseId);
    return { ok: true };
  });

export const submitQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ lesson_id: z.string().uuid(), answers: z.array(z.number().int()).max(50) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const s = supabase as any;
    const info = await lessonCourseId(s, data.lesson_id);
    if (!info) throw new Error("Quiz not found");
    const { data: questions } = await s
      .from("quiz_questions")
      .select("id, correct_index, explanation, position")
      .eq("lesson_id", data.lesson_id)
      .order("position");
    const qs = questions ?? [];
    if (qs.length === 0) throw new Error("This quiz has no questions yet.");
    let correct = 0;
    const results = qs.map((qq: any, i: number) => {
      const ok = data.answers[i] === qq.correct_index;
      if (ok) correct += 1;
      return { id: qq.id as string, correct: ok, correct_index: qq.correct_index as number, explanation: (qq.explanation ?? null) as string | null };
    });
    const score = correct / qs.length;
    const passed = score >= info.threshold;

    const enrollmentId = await resolveEnrollment(s, userId, info.courseId);
    // Current-attempt-only: overwrite. completed_at set only on pass.
    await s
      .from("lesson_progress")
      .upsert(
        {
          enrollment_id: enrollmentId,
          lesson_id: data.lesson_id,
          quiz_score: score,
          completed_at: passed ? new Date().toISOString() : null,
        },
        { onConflict: "enrollment_id,lesson_id" },
      );
    await recomputeCompletion(s, enrollmentId, info.courseId);
    return { passed, score, threshold: info.threshold, results };
  });


function normalizeRefLinks(links: { label: string; kind: "external" | "internal"; url: string; note?: string }[]) {
  return links.map((l) => {
    let url = l.url.trim();
    if (l.kind === "internal") {
      if (!url.startsWith("/")) url = "/" + url;
      if (!url.startsWith("/portal")) throw new Error("Portal links must start with /portal");
    } else {
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      try {
        const u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
      } catch {
        throw new Error(`Invalid link: ${l.url}`);
      }
    }
    return { label: l.label, kind: l.kind, url, note: l.note || null };
  });
}
