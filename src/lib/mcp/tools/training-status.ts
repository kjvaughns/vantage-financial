import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_training_status",
  title: "Get training status",
  description: "An applicant/agent's release-track training: unlock, each day's approval, submissions waiting, release and cleared-to-call dates.",
  inputSchema: { id: z.string().uuid().describe("Applicant id") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data: a, error } = await sb
      .from("applicants")
      .select("id, first_name, last_name, portal_profile_id, onboarding_completed_at, training_unlocked_at, release_requested_at, release_passed_at, cleared_to_call_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!a) throw new Error("Applicant not found or you don't have access.");
    if (!a.portal_profile_id) return json({ applicant: a, days: [], note: "No portal account yet." });
    const [{ data: days }, { data: progress }, { data: subs }] = await Promise.all([
      sb.from("training_days").select("id, title, day_label, position, is_release").eq("is_published", true).order("position"),
      sb.from("training_progress").select("day_id, approved_at, is_override").eq("profile_id", a.portal_profile_id),
      sb.from("training_submissions").select("day_id, status, created_at, feedback").eq("profile_id", a.portal_profile_id),
    ]);
    return json({
      applicant: a,
      days: (days ?? []).map((d) => ({
        ...d,
        approved_at: progress?.find((p) => p.day_id === d.id)?.approved_at ?? null,
        submissions: (subs ?? []).filter((s) => s.day_id === d.id),
      })),
    });
  },
});
