import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "pipeline_summary",
  title: "Pipeline summary",
  description: "Applicant counts per stage plus upcoming scheduled interviews.",
  inputSchema: { upcoming_days: z.number().int().min(1).max(30).default(7) },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ upcoming_days }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data: stages } = await sb.from("pipeline_stages").select("id, slug, name");
    const { data: apps, error } = await sb.from("applicants").select("current_stage_id").is("archived_at", null).limit(10000);
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    for (const s of stages ?? []) counts[s.slug] = 0;
    const slugById = new Map((stages ?? []).map((s) => [s.id, s.slug]));
    for (const a of apps ?? []) {
      const slug = slugById.get(a.current_stage_id as string) ?? "unknown";
      counts[slug] = (counts[slug] ?? 0) + 1;
    }
    const now = new Date();
    const end = new Date(now.getTime() + upcoming_days * 86400000);
    const { data: upcoming } = await sb.from("applicants")
      .select("id, first_name, last_name, phone, licensed, scheduled_event_start")
      .gte("scheduled_event_start", now.toISOString()).lte("scheduled_event_start", end.toISOString())
      .order("scheduled_event_start");
    return json({ counts, upcoming_interviews: upcoming ?? [] });
  },
});
