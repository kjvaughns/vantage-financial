import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

/** Supabase client acting as the signed-in OAuth caller — RLS applies. */
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const APPLICANT_FIELDS =
  "id, first_name, last_name, email, phone, state, licensed, has_downlines, applicant_type, agency_track, agency_name, status, created_at, stage_entered_at, scheduled_event_start, scheduling_status, course_confirmed_at, referred_by_name, referred_by_profile_id, current_stage_id, pipeline_stages(slug, name)";

export function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/** Confirms the caller can see the applicant under RLS before privileged work. */
export async function assertCanSee(ctx: ToolContext, id: string) {
  const { data } = await supabaseForUser(ctx).from("applicants").select("id").eq("id", id).maybeSingle();
  if (!data) throw new Error("Applicant not found or you don't have access.");
}
