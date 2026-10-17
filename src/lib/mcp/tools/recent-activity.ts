import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "recent_activity",
  title: "Recent activity",
  description: "Events since a time: new applications, bookings, reschedules, cancellations, stage changes, notes. Poll with the returned next_since.",
  inputSchema: {
    since: z.string().datetime().describe("ISO time; returns events after it."),
    event_types: z.array(z.string().max(60)).max(20).optional(),
    limit: z.number().int().min(1).max(200).default(100),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ since, event_types, limit }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb.from("applicant_activities")
      .select("applicant_id, event_type, summary, data, created_at, applicants(first_name, last_name, email)")
      .gt("created_at", since).order("created_at", { ascending: true }).limit(limit);
    if (event_types?.length) q = q.in("event_type", event_types);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const { data: newApps } = await sb.from("applicants")
      .select("id, first_name, last_name, email, licensed, agency_track, created_at")
      .gt("created_at", since).order("created_at").limit(limit);
    const last = [...(data ?? []), ...(newApps ?? [])].map((r) => r.created_at).sort().pop();
    return json({ new_applicants: newApps ?? [], events: data ?? [], next_since: last ?? since });
  },
});
