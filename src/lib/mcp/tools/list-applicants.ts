import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { APPLICANT_FIELDS, json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_applicants",
  title: "List applicants",
  description: "Search and filter applicants you can see, newest first.",
  inputSchema: {
    search: z.string().max(100).optional().describe("Name, email or phone fragment."),
    stage: z.string().max(50).optional().describe("Stage slug, e.g. new-applicant, interview-scheduled, onboarding."),
    licensed: z.boolean().optional(),
    agency_track: z.enum(["builder", "owner"]).optional(),
    referred_by_profile_id: z.string().uuid().optional(),
    since: z.string().datetime().optional().describe("Only applicants created after this ISO time."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (i, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb.from("applicants").select(APPLICANT_FIELDS).is("archived_at", null)
      .order("created_at", { ascending: false }).limit(i.limit);
    if (i.search) {
      const s = i.search.replace(/[,()%]/g, "");
      q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
    }
    if (i.licensed !== undefined) q = q.eq("licensed", i.licensed);
    if (i.agency_track) q = q.eq("agency_track", i.agency_track);
    if (i.referred_by_profile_id) q = q.eq("referred_by_profile_id", i.referred_by_profile_id);
    if (i.since) q = q.gte("created_at", i.since);
    if (i.stage) {
      const { data: st } = await sb.from("pipeline_stages").select("id").eq("slug", i.stage).maybeSingle();
      if (!st) throw new Error(`Unknown stage ${i.stage}`);
      q = q.eq("current_stage_id", st.id);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return json({ applicants: data });
  },
});
