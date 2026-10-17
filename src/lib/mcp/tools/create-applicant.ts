import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_applicant",
  title: "Create applicant",
  description: "Add a new applicant to the CRM, assigned to you as recruiter.",
  inputSchema: {
    first_name: z.string().min(1).max(80),
    last_name: z.string().min(1).max(80),
    email: z.string().email().max(255),
    phone: z.string().max(30).optional(),
    state: z.string().max(30).optional(),
    licensed: z.boolean().default(false),
    notes: z.string().max(2000).optional().describe("Why they're interested / context."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (i, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data: stage } = await sb.from("pipeline_stages").select("id").eq("slug", "new-applicant").maybeSingle();
    const { data, error } = await sb.from("applicants").insert({
      first_name: i.first_name, last_name: i.last_name, email: i.email.toLowerCase(),
      phone: i.phone ?? null, state: i.state ?? null, licensed: i.licensed,
      why_text: i.notes ?? null, assigned_recruiter_id: ctx.getUserId(),
      current_stage_id: stage?.id ?? null, referral_source: "hyperagent",
    } as never).select("id").single();
    if (error) throw new Error(error.message);
    return json({ ok: true, id: (data as { id: string }).id });
  },
});
