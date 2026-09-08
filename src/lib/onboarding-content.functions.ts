/**
 * Admin-editable onboarding content, training schedule and shared links.
 * Step definitions live in the database so admins can add, reorder, publish and
 * unpublish steps without code changes. Progress stays in
 * `applicants.onboarding_steps` (keyed by step_key) so existing CRM counters,
 * emails and automations keep working.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManage } from "@/lib/academy/guard";

export type OnboardingStepRow = {
  id: string;
  section_id: string | null;
  step_key: string;
  title: string;
  description: string | null;
  instructions: string | null;
  position: number;
  is_published: boolean;
  is_required: boolean;
  action_type: "none" | "external" | "internal" | "course" | "resource" | "presentation";
  action_url: string | null;
  internal_path: string | null;
  course_id: string | null;
  resource_id: string | null;
  recording_id: string | null;
  button_label: string | null;
  completion_mode: "self" | "admin" | "auto";
  auto_course_id: string | null;
  show_schedule: boolean;
  show_upline: boolean;
};

export type OnboardingSectionRow = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  is_published: boolean;
};

export type ScheduleItemRow = {
  id: string;
  label: string;
  when_text: string;
  note: string | null;
  position: number;
  is_active: boolean;
};

export type AppLinkRow = { key: string; label: string; url: string; description: string | null };

const STEP_COLS =
  "id, section_id, step_key, title, description, instructions, position, is_published, is_required, action_type, action_url, internal_path, course_id, resource_id, recording_id, button_label, completion_mode, auto_course_id, show_schedule, show_upline";

/** Published onboarding content + schedule + links for the agent-facing page. */
export const getOnboardingContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = context.supabase as any;
    const [sections, steps, schedule, links, courses] = await Promise.all([
      s.from("onboarding_sections").select("id, title, description, position, is_published").order("position"),
      s.from("onboarding_steps").select(STEP_COLS).eq("is_published", true).order("position"),
      s.from("training_schedule_items").select("id, label, when_text, note, position, is_active").eq("is_active", true).order("position"),
      s.from("app_links").select("key, label, url, description"),
      s.from("courses").select("id, slug, title, status"),
    ]);
    const courseById: Record<string, { slug: string; title: string; status: string }> = {};
    for (const c of courses.data ?? []) courseById[c.id] = { slug: c.slug, title: c.title, status: c.status };
    return {
      sections: (sections.data ?? []).filter((x: any) => x.is_published) as OnboardingSectionRow[],
      steps: (steps.data ?? []) as OnboardingStepRow[],
      schedule: (schedule.data ?? []) as ScheduleItemRow[],
      links: Object.fromEntries((links.data ?? []).map((l: any) => [l.key, l.url])) as Record<string, string>,
      courseById,
    };
  });

/** Everything (including drafts) for the admin builder. */
export const getOnboardingAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManage(context.supabase, context.userId);
    const s = context.supabase as any;
    const [sections, steps, schedule, links, courses, resources, recordings] = await Promise.all([
      s.from("onboarding_sections").select("id, title, description, position, is_published").order("position"),
      s.from("onboarding_steps").select(STEP_COLS).order("position"),
      s.from("training_schedule_items").select("id, label, when_text, note, position, is_active").order("position"),
      s.from("app_links").select("key, label, url, description").order("key"),
      s.from("courses").select("id, title, slug, status").order("title"),
      s.from("library_resources").select("id, title, slug").order("title"),
      s.from("recordings").select("id, title, slug").order("title"),
    ]);
    return {
      sections: (sections.data ?? []) as OnboardingSectionRow[],
      steps: (steps.data ?? []) as OnboardingStepRow[],
      schedule: (schedule.data ?? []) as ScheduleItemRow[],
      links: (links.data ?? []) as AppLinkRow[],
      courses: (courses.data ?? []) as { id: string; title: string; slug: string | null; status: string }[],
      resources: (resources.data ?? []) as { id: string; title: string; slug: string | null }[],
      recordings: (recordings.data ?? []) as { id: string; title: string; slug: string | null }[],
    };
  });

const sectionSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullish(),
  is_published: z.boolean().optional(),
});

export const saveOnboardingSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sectionSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertCanManage(context.supabase, context.userId);
    const s = context.supabase as any;
    if (data.id) {
      const { error } = await s
        .from("onboarding_sections")
        .update({ title: data.title, description: data.description ?? null, is_published: data.is_published ?? true })
        .eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: max } = await s
      .from("onboarding_sections")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: row, error } = await s
      .from("onboarding_sections")
      .insert({
        title: data.title,
        description: data.description ?? null,
        is_published: data.is_published ?? true,
        position: (max?.position ?? -1) + 1,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const deleteOnboardingSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertCanManage(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("onboarding_sections").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const stepSchema = z.object({
  id: z.string().uuid().optional(),
  section_id: z.string().uuid().nullish(),
  step_key: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores only."),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  instructions: z.string().max(8000).nullish(),
  is_published: z.boolean().optional(),
  is_required: z.boolean().optional(),
  action_type: z.enum(["none", "external", "internal", "course", "resource", "presentation"]).optional(),
  action_url: z.string().max(1000).nullish(),
  internal_path: z.string().max(300).nullish(),
  course_id: z.string().uuid().nullish(),
  resource_id: z.string().uuid().nullish(),
  recording_id: z.string().uuid().nullish(),
  button_label: z.string().max(80).nullish(),
  completion_mode: z.enum(["self", "admin", "auto"]).optional(),
  auto_course_id: z.string().uuid().nullish(),
  show_schedule: z.boolean().optional(),
  show_upline: z.boolean().optional(),
});

export const saveOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => stepSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertCanManage(context.supabase, context.userId);
    const s = context.supabase as any;
    const payload = {
      section_id: data.section_id ?? null,
      step_key: data.step_key,
      title: data.title,
      description: data.description ?? null,
      instructions: data.instructions ?? null,
      is_published: data.is_published ?? true,
      is_required: data.is_required ?? true,
      action_type: data.action_type ?? "none",
      action_url: data.action_url || null,
      internal_path: data.internal_path || null,
      course_id: data.course_id ?? null,
      resource_id: data.resource_id ?? null,
      recording_id: data.recording_id ?? null,
      button_label: data.button_label || null,
      completion_mode: data.completion_mode ?? "self",
      auto_course_id: data.completion_mode === "auto" ? data.auto_course_id ?? data.course_id ?? null : null,
      show_schedule: data.show_schedule ?? false,
      show_upline: data.show_upline ?? false,
    };
    if (data.id) {
      const { error } = await s.from("onboarding_steps").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: max } = await s
      .from("onboarding_steps")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: row, error } = await s
      .from("onboarding_steps")
      .insert({ ...payload, position: (max?.position ?? -1) + 1 })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const deleteOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertCanManage(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("onboarding_steps").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const duplicateOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertCanManage(context.supabase, context.userId);
    const s = context.supabase as any;
    const { data: row, error } = await s.from("onboarding_steps").select(STEP_COLS).eq("id", data.id).single();
    if (error) throw error;
    const { id, ...rest } = row as any;
    let key = `${row.step_key}_copy`;
    for (let i = 2; i < 50; i++) {
      const { data: clash } = await s.from("onboarding_steps").select("id").eq("step_key", key).maybeSingle();
      if (!clash) break;
      key = `${row.step_key}_copy${i}`;
    }
    const { error: insErr } = await s.from("onboarding_steps").insert({
      ...rest,
      step_key: key,
      title: `${row.title} (copy)`,
      is_published: false,
      position: (row.position ?? 0) + 1,
    });
    if (insErr) throw insErr;
    return { ok: true };
  });

/** Move a step (or section, or schedule item) up/down by swapping with its neighbour. */
export const reorderOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        table: z.enum(["onboarding_steps", "onboarding_sections", "training_schedule_items"]),
        id: z.string().uuid(),
        direction: z.enum(["up", "down"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManage(context.supabase, context.userId);
    const s = context.supabase as any;
    const { data: rows, error } = await s.from(data.table).select("id, position").order("position");
    if (error) throw error;
    const list = rows ?? [];
    const i = list.findIndex((r: any) => r.id === data.id);
    const j = data.direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return { ok: true };
    await s.from(data.table).update({ position: list[j].position }).eq("id", list[i].id);
    await s.from(data.table).update({ position: list[i].position }).eq("id", list[j].id);
    return { ok: true };
  });

// ---- Training schedule -----------------------------------------------------

export const saveScheduleItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        label: z.string().min(1).max(200),
        when_text: z.string().min(1).max(200),
        note: z.string().max(500).nullish(),
        is_active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManage(context.supabase, context.userId);
    const s = context.supabase as any;
    const payload = {
      label: data.label,
      when_text: data.when_text,
      note: data.note || null,
      is_active: data.is_active ?? true,
    };
    if (data.id) {
      const { error } = await s.from("training_schedule_items").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: max } = await s
      .from("training_schedule_items")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await s.from("training_schedule_items").insert({ ...payload, position: (max?.position ?? -1) + 1 });
    if (error) throw error;
    return { ok: true };
  });

export const deleteScheduleItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertCanManage(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("training_schedule_items").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---- Shared links ----------------------------------------------------------

export const saveAppLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        key: z.string().min(2).max(60).regex(/^[a-z0-9_]+$/),
        label: z.string().min(1).max(200),
        url: z.string().url().max(1000),
        description: z.string().max(500).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManage(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("app_links")
      .upsert(
        { key: data.key, label: data.label, url: data.url, description: data.description || null, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw error;
    return { ok: true };
  });

// ---- Admin: confirm a step for an agent ------------------------------------

export const setAgentOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ applicant_id: z.string().uuid(), step: z.string().min(1).max(80), completed: z.boolean() })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: res, error } = await (context.supabase as any).rpc("admin_set_onboarding_step", {
      _applicant_id: data.applicant_id,
      _step: data.step,
      _completed: data.completed,
    });
    if (error) throw error;
    return res as { ok: boolean };
  });
