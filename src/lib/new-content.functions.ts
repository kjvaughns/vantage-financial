import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Only published content visible through the caller's existing RLS counts. */
export const getNewContentDates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [courses, recordings, library, training] = await Promise.all([
      sb.from("courses").select("created_at").eq("status", "published").order("created_at", { ascending: false }).limit(1),
      sb.from("recordings").select("created_at").eq("status", "published").order("created_at", { ascending: false }).limit(1),
      sb.from("library_resources").select("created_at").eq("status", "published").order("created_at", { ascending: false }).limit(1),
      sb.from("training_days").select("created_at").eq("is_published", true).order("created_at", { ascending: false }).limit(1),
    ]);
    for (const result of [courses, recordings, library, training]) {
      if (result.error) throw new Error("Couldn't check new company content.");
    }
    const academyDates = [courses, recordings, library].flatMap((result) => result.data?.map((row) => row.created_at) ?? []);
    return {
      academy: academyDates.sort().at(-1) ?? null,
      training: training.data?.[0]?.created_at ?? null,
    };
  });