import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertCanManage } from "@/lib/academy/guard";

/* ============================================================ */
/* Template payload shapes                                       */
/* ============================================================ */

export const TEMPLATE_KINDS = ["course", "library", "recording"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

const questionPayload = z.object({
  question_text: z.string().max(1000),
  options: z.array(z.string().max(400)).min(2).max(8),
  correct_index: z.number().int().min(0).max(7),
  explanation: z.string().max(1000).optional().nullable(),
});

const lessonPayload = z.object({
  title: z.string().max(200),
  kind: z.enum(["video", "audio", "text", "resource", "link", "quiz"]),
  blurb: z.string().max(1000).optional().nullable(),
  body: z.string().max(20000).optional().nullable(),
  duration: z.string().max(40).optional().nullable(),
  resource_label: z.string().max(200).optional().nullable(),
  quiz_pass_threshold: z.number().min(0).max(100).optional().nullable(),
  questions: z.array(questionPayload).max(30).optional(),
});

const coursePayload = z.object({
  course: z.object({
    title: z.string().max(200),
    description: z.string().max(1000).optional().nullable(),
    long_description: z.string().max(6000).optional().nullable(),
    instructor_name: z.string().max(160).optional().nullable(),
    instructor_role: z.string().max(160).optional().nullable(),
    outcomes: z.array(z.string().max(300)).max(20).optional(),
    is_required: z.boolean().optional(),
  }),
  modules: z
    .array(z.object({ title: z.string().max(200), lessons: z.array(lessonPayload).max(60).optional() }))
    .max(30),
});

const libraryPayload = z.object({
  items: z
    .array(
      z.object({
        title: z.string().max(200),
        type: z.string().max(40),
        description: z.string().max(4000).optional().nullable(),
        category: z.string().max(80).optional().nullable(),
        is_required: z.boolean().optional(),
      }),
    )
    .max(40),
});

const recordingPayload = z.object({
  title: z.string().max(200),
  topic: z.string().max(200).optional().nullable(),
  format: z.enum(["video", "audio"]).optional(),
  description: z.string().max(6000).optional().nullable(),
  duration: z.string().max(40).optional().nullable(),
});

function parsePayload(kind: TemplateKind, payload: unknown) {
  if (kind === "course") return coursePayload.parse(payload);
  if (kind === "library") return libraryPayload.parse(payload);
  return recordingPayload.parse(payload);
}

function slugify(txt: string) {
  return (
    txt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "template"
  );
}

/* ============================================================ */
/* Template CRUD                                                 */
/* ============================================================ */

export const adminListTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { data } = await (supabase as any)
      .from("academy_templates")
      .select("*")
      .order("kind")
      .order("title");
    return { templates: data ?? [] };
  });

export const adminUpsertTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        kind: z.enum(TEMPLATE_KINDS),
        title: z.string().trim().min(1).max(200),
        description: z.string().max(2000).optional().or(z.literal("")),
        payload: z.unknown(),
        is_active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const payload = parsePayload(data.kind, data.payload);
    const patch: Record<string, unknown> = {
      kind: data.kind,
      title: data.title,
      description: data.description || null,
      payload,
      is_active: data.is_active ?? true,
    };
    if (data.id) {
      const { error } = await s.from("academy_templates").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const base = slugify(data.title);
    let slug = base;
    for (let i = 2; i < 60; i++) {
      const { data: clash } = await s.from("academy_templates").select("id").eq("slug", slug).maybeSingle();
      if (!clash) break;
      slug = `${base}-${i}`;
    }
    const { data: created, error } = await s
      .from("academy_templates")
      .insert({ ...patch, slug })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const adminSetTemplateActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any)
      .from("academy_templates")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any).from("academy_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDuplicateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const { data: row } = await s.from("academy_templates").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Template not found");
    const base = slugify(`${row.title} copy`);
    let slug = base;
    for (let i = 2; i < 60; i++) {
      const { data: clash } = await s.from("academy_templates").select("id").eq("slug", slug).maybeSingle();
      if (!clash) break;
      slug = `${base}-${i}`;
    }
    const { data: created, error } = await s
      .from("academy_templates")
      .insert({
        slug,
        kind: row.kind,
        title: `${row.title} (copy)`,
        description: row.description,
        payload: row.payload,
        is_active: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

/* ============================================================ */
/* Applying a template — always creates drafts                   */
/* ============================================================ */

async function insertCourseTree(s: any, tree: z.infer<typeof coursePayload>, titleOverride?: string) {
  const c = tree.course;
  const { data: course, error } = await s
    .from("courses")
    .insert({
      title: titleOverride || c.title,
      description: c.description ?? null,
      long_description: c.long_description ?? null,
      instructor_name: c.instructor_name ?? null,
      instructor_role: c.instructor_role ?? null,
      outcomes: c.outcomes ?? [],
      is_required: c.is_required ?? false,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  let mPos = 0;
  for (const m of tree.modules ?? []) {
    const { data: mod, error: mErr } = await s
      .from("course_modules")
      .insert({ course_id: course.id, title: m.title, position: mPos++ })
      .select("id")
      .single();
    if (mErr) throw new Error(mErr.message);
    let lPos = 0;
    for (const l of m.lessons ?? []) {
      const { data: lesson, error: lErr } = await s
        .from("course_lessons")
        .insert({
          module_id: mod.id,
          title: l.title,
          kind: l.kind,
          position: lPos++,
          blurb: l.blurb ?? null,
          body: l.body ?? null,
          duration: l.duration ?? null,
          resource_label: l.resource_label ?? null,
          media_type: l.kind === "video" ? "video" : l.kind === "audio" ? "audio" : null,
          quiz_pass_threshold: l.quiz_pass_threshold ?? 80,
          is_published: false,
        })
        .select("id")
        .single();
      if (lErr) throw new Error(lErr.message);
      let qPos = 0;
      for (const q of l.questions ?? []) {
        const { error: qErr } = await s.from("quiz_questions").insert({
          lesson_id: lesson.id,
          question_text: q.question_text,
          options: q.options,
          correct_index: q.correct_index,
          explanation: q.explanation ?? null,
          position: qPos++,
        });
        if (qErr) throw new Error(qErr.message);
      }
    }
  }
  return course.id as string;
}

export const adminApplyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), title: z.string().trim().max(200).optional().or(z.literal("")) })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const { data: tpl } = await s.from("academy_templates").select("*").eq("id", data.id).maybeSingle();
    if (!tpl) throw new Error("Template not found");
    const kind = tpl.kind as TemplateKind;

    if (kind === "course") {
      const tree = coursePayload.parse(tpl.payload);
      const id = await insertCourseTree(s, tree, data.title || undefined);
      return { kind, courseId: id, count: 1 };
    }

    if (kind === "library") {
      const { items } = libraryPayload.parse(tpl.payload);
      let count = 0;
      for (const it of items) {
        const { error } = await s.from("library_resources").insert({
          title: it.title,
          type: it.type,
          description: it.description ?? null,
          category: it.category ?? null,
          is_required: it.is_required ?? false,
          status: "draft",
          section: "library",
        });
        if (error) throw new Error(error.message);
        count++;
      }
      return { kind, count };
    }

    const rec = recordingPayload.parse(tpl.payload);
    let { data: presenter } = await s.from("presenters").select("id").order("sort_order").limit(1).maybeSingle();
    if (!presenter) {
      const { data: created, error } = await s
        .from("presenters")
        .insert({ name: "Vantage Financial", slug: "vantage-financial", initials: "VF", is_external: true })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      presenter = created;
    }
    const { error: rErr } = await s.from("recordings").insert({
      presenter_id: presenter.id,
      title: data.title || rec.title,
      topic: rec.topic ?? null,
      description: rec.description ?? null,
      format: rec.format ?? "video",
      duration: rec.duration ?? null,
      status: "draft",
    });
    if (rErr) throw new Error(rErr.message);
    return { kind, count: 1 };
  });

/* ============================================================ */
/* Save an existing course as a reusable template                */
/* ============================================================ */

export const adminSaveCourseAsTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        course_id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        description: z.string().max(2000).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const { data: course } = await s.from("courses").select("*").eq("id", data.course_id).maybeSingle();
    if (!course) throw new Error("Course not found");
    const { data: modules } = await s
      .from("course_modules")
      .select("*")
      .eq("course_id", course.id)
      .order("position");
    const moduleIds = (modules ?? []).map((m: any) => m.id);
    const { data: lessons } = moduleIds.length
      ? await s.from("course_lessons").select("*").in("module_id", moduleIds).order("position")
      : { data: [] };
    const quizIds = (lessons ?? []).filter((l: any) => l.kind === "quiz").map((l: any) => l.id);
    const { data: questions } = quizIds.length
      ? await s.from("quiz_questions").select("*").in("lesson_id", quizIds).order("position")
      : { data: [] };

    const payload = {
      course: {
        title: course.title,
        description: course.description,
        long_description: course.long_description,
        instructor_name: course.instructor_name,
        instructor_role: course.instructor_role,
        outcomes: course.outcomes ?? [],
        is_required: !!course.is_required,
      },
      modules: (modules ?? []).map((m: any) => ({
        title: m.title,
        lessons: (lessons ?? [])
          .filter((l: any) => l.module_id === m.id)
          .map((l: any) => ({
            title: l.title,
            kind: l.kind,
            blurb: l.blurb,
            body: l.body,
            duration: l.duration,
            resource_label: l.resource_label,
            quiz_pass_threshold: l.quiz_pass_threshold ? Number(l.quiz_pass_threshold) : 80,
            questions: (questions ?? [])
              .filter((q: any) => q.lesson_id === l.id)
              .map((q: any) => ({
                question_text: q.question_text,
                options: q.options ?? [],
                correct_index: q.correct_index ?? 0,
                explanation: q.explanation,
              })),
          })),
      })),
    };

    const parsed = coursePayload.parse(payload);
    const base = slugify(data.title);
    let slug = base;
    for (let i = 2; i < 60; i++) {
      const { data: clash } = await s.from("academy_templates").select("id").eq("slug", slug).maybeSingle();
      if (!clash) break;
      slug = `${base}-${i}`;
    }
    const { data: created, error } = await s
      .from("academy_templates")
      .insert({
        slug,
        kind: "course",
        title: data.title,
        description: data.description || null,
        payload: parsed,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

/* ============================================================ */
/* Duplication                                                   */
/* ============================================================ */

export const adminSetCourseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "published"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any)
      .from("courses")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDuplicateCourse = createServerFn({ method: "POST" })
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
      .eq("course_id", course.id)
      .order("position");
    const moduleIds = (modules ?? []).map((m: any) => m.id);
    const { data: lessons } = moduleIds.length
      ? await s.from("course_lessons").select("*").in("module_id", moduleIds).order("position")
      : { data: [] };
    const quizIds = (lessons ?? []).filter((l: any) => l.kind === "quiz").map((l: any) => l.id);
    const { data: questions } = quizIds.length
      ? await s.from("quiz_questions").select("*").in("lesson_id", quizIds).order("position")
      : { data: [] };

    const { data: copy, error } = await s
      .from("courses")
      .insert({
        title: `${course.title} (copy)`,
        slug: null,
        description: course.description,
        long_description: course.long_description,
        instructor_name: course.instructor_name,
        instructor_role: course.instructor_role,
        thumbnail_url: course.thumbnail_url,
        outcomes: course.outcomes ?? [],
        is_required: course.is_required,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    for (const m of modules ?? []) {
      const { data: mod, error: mErr } = await s
        .from("course_modules")
        .insert({ course_id: copy.id, title: m.title, position: m.position })
        .select("id")
        .single();
      if (mErr) throw new Error(mErr.message);
      for (const l of (lessons ?? []).filter((x: any) => x.module_id === m.id)) {
        const { id: _lid, module_id: _mid, ...rest } = l;
        const { data: lesson, error: lErr } = await s
          .from("course_lessons")
          .insert({ ...rest, module_id: mod.id, is_published: false })
          .select("id")
          .single();
        if (lErr) throw new Error(lErr.message);
        for (const q of (questions ?? []).filter((x: any) => x.lesson_id === l.id)) {
          const { id: _qid, lesson_id: _qlid, ...qrest } = q;
          const { error: qErr } = await s.from("quiz_questions").insert({ ...qrest, lesson_id: lesson.id });
          if (qErr) throw new Error(qErr.message);
        }
      }
    }
    return { id: copy.id as string };
  });

export const adminDuplicateLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const { data: row } = await s.from("library_resources").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Library item not found");
    const { id: _id, slug: _slug, created_at: _c, updated_at: _u, ...rest } = row;
    const { data: created, error } = await s
      .from("library_resources")
      .insert({ ...rest, title: `${row.title} (copy)`, slug: null, status: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });
