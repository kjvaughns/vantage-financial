import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { applicantExamSchema } from "@/lib/applicant-exam";
import { json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_applicant_exam",
  title: "Update applicant licensing exam",
  description: "Record an applicant's exam date, format, testing provider, result, NPN, resident state and exam notes within your existing CRM permissions; does not change pipeline stages or send emails.",
  inputSchema: applicantExamSchema.shape,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ applicant_id, notes, ...fields }, ctx) => {
    const patch = { ...fields, exam_notes: notes };
    if (!Object.values(patch).some((value) => value !== undefined)) throw new ToolError("Provide at least one exam field to update.");
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("applicants").update(patch).eq("id", applicant_id)
      .select("id, exam_date, exam_format, exam_provider, exam_result, npn, resident_state, exam_notes").maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Applicant not found or you don't have permission to update them.");
    return json({ applicant: data });
  },
});