import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_applicant",
  title: "Get applicant",
  description: "Full applicant profile with answers, stage, scheduled call and recent activity/notes.",
  inputSchema: { id: z.string().uuid() },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("applicants")
      .select("*, pipeline_stages(slug, name)").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Applicant not found or you don't have access.");
    const { confirmation_token: _t, ...applicant } = data as Record<string, unknown>;
    const { data: activity } = await sb.from("applicant_activities")
      .select("event_type, summary, data, created_at").eq("applicant_id", id)
      .order("created_at", { ascending: false }).limit(30);
    return json({ applicant, activity });
  },
});
