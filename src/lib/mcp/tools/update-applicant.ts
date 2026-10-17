import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_applicant",
  title: "Update applicant details",
  description: "Update an applicant's basic contact fields (email, phone, state, licensed, priority).",
  inputSchema: {
    id: z.string().uuid(),
    email: z.string().email().max(255).optional(),
    phone: z.string().max(30).optional(),
    state: z.string().max(30).optional(),
    licensed: z.boolean().optional(),
    priority: z.string().max(20).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, ...patch }, ctx) => {
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (!Object.keys(clean).length) throw new Error("Nothing to update.");
    const { data, error } = await supabaseForUser(ctx).from("applicants")
      .update(clean as never).eq("id", id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Applicant not found or you don't have access.");
    return json({ ok: true });
  },
});
