import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "set_course_confirmed",
  title: "Set course purchase confirmed",
  description: "Mark (or unmark) an applicant's pre-licensing course purchase as confirmed.",
  inputSchema: { id: z.string().uuid(), confirmed: z.boolean().default(true) },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, confirmed }, ctx) => {
    const { data, error } = await supabaseForUser(ctx).from("applicants")
      .update({ course_confirmed_at: confirmed ? new Date().toISOString() : null } as never)
      .eq("id", id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Applicant not found or you don't have access.");
    const engine = await import("@/lib/recruiting/stage-engine.server");
    await engine.logActivity(id, confirmed ? "course_confirmed" : "course_unconfirmed",
      confirmed ? "Course purchase confirmed" : "Course confirmation removed", { source: "hyperagent" });
    return json({ ok: true });
  },
});
