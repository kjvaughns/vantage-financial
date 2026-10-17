import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { assertCanSee, json } from "../supabase";

const STAGES = [
  "new-applicant", "interview-scheduled", "interview-completed", "pre-licensing", "state-exam",
  "licensing", "onboarding", "training", "active-agent", "not-moving-forward",
] as const;

export default defineTool({
  name: "change_applicant_stage",
  title: "Change applicant stage",
  description: "Move an applicant to a pipeline stage; runs the normal stage automations and emails.",
  inputSchema: { id: z.string().uuid(), stage: z.enum(STAGES) },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  handler: async ({ id, stage }, ctx) => {
    await assertCanSee(ctx, id);
    const engine = await import("@/lib/recruiting/stage-engine.server");
    await engine.applyStage({ applicantId: id, stage, actorId: ctx.getUserId(), reason: "hyperagent" });
    return json({ ok: true, stage });
  },
});
