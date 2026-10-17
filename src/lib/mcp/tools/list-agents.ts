import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_agents",
  title: "List agents",
  description: "List agents on your team with upline, license status and onboarding progress.",
  inputSchema: {
    search: z.string().max(100).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb.from("profiles")
      .select("id, full_name, email, phone, licensed, state, status, is_active, manager_id, parent_user_id, created_at")
      .order("created_at", { ascending: false }).limit(limit);
    if (search) {
      const s = search.replace(/[,()%]/g, "");
      q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((p) => p.id);
    const { data: apps } = ids.length
      ? await sb.from("applicants").select("portal_profile_id, onboarding_steps, onboarding_completed_at").in("portal_profile_id", ids)
      : { data: [] as never[] };
    const byId = new Map((apps ?? []).map((a: any) => [a.portal_profile_id, a]));
    return json({
      agents: (data ?? []).map((p) => ({
        ...p,
        onboarding_steps: byId.get(p.id)?.onboarding_steps ?? null,
        onboarding_completed_at: byId.get(p.id)?.onboarding_completed_at ?? null,
      })),
    });
  },
});
