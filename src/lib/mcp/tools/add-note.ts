import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { assertCanSee, json } from "../supabase";

export default defineTool({
  name: "add_applicant_note",
  title: "Add applicant note",
  description: "Add a note to an applicant's activity history.",
  inputSchema: { id: z.string().uuid(), note: z.string().min(1).max(4000) },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ id, note }, ctx) => {
    await assertCanSee(ctx, id);
    const engine = await import("@/lib/recruiting/stage-engine.server");
    await engine.logActivity(id, "note", note, { source: "hyperagent", actor_id: ctx.getUserId() });
    return json({ ok: true });
  },
});
