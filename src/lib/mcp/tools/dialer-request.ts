import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "submit_dialer_request",
  title: "Submit dialer support request",
  description: "Super admin only: add or remove dialer lead types (FEX, VETS, MP) and states for any active agent. Writes to the dialer sheet and emails the agent a confirmation. Use list_agents to find the agent's id.",
  inputSchema: {
    agent_id: z.string().uuid().describe("The agent's user id."),
    add_lead_types: z.array(z.enum(["FEX", "VETS", "MP"])).optional(),
    remove_lead_types: z.array(z.enum(["FEX", "VETS", "MP"])).optional(),
    add_states: z.array(z.string().length(2)).optional().describe("Two-letter state codes, e.g. TX."),
    remove_states: z.array(z.string().length(2)).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  handler: async ({ agent_id, add_lead_types = [], remove_lead_types = [], add_states = [], remove_states = [] }, ctx) => {
    const caller = supabaseForUser(ctx);
    const { data: roles, error } = await caller.from("user_roles").select("role").eq("user_id", ctx.getUserId()!);
    if (error) throw new ToolError(error.message);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "super_admin")) throw new ToolError("Only super admins can submit dialer requests for other agents.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [{ data: prof }, { data: existing }] = await Promise.all([
      db.from("profiles").select("first_name, last_name, full_name, is_active").eq("id", agent_id).maybeSingle(),
      db.from("dialer_requests").select("agent_name, lead_types, states").eq("user_id", agent_id).maybeSingle(),
    ]);
    if (!prof?.is_active) throw new ToolError("No active agent with that id.");
    const up = (a: string[]) => a.map((x) => x.toUpperCase());
    const leads = [...new Set([...(existing?.lead_types ?? []).filter((x: string) => !remove_lead_types.includes(x as never)), ...add_lead_types])];
    const states = [...new Set([...(existing?.states ?? []).filter((x: string) => !up(remove_states).includes(x)), ...up(add_states)])];
    const name = existing?.agent_name || (prof.full_name || [prof.first_name, prof.last_name].filter(Boolean).join(" ")).trim();
    const { submitDialerRequest } = await import("@/lib/dialer/request.server");
    try { await submitDialerRequest(db, agent_id, { agent_name: name, lead_types: leads, states }); }
    catch (e) { throw new ToolError(e instanceof Error ? e.message : String(e)); }
    return json({ ok: true, agent: name, lead_types: leads, states });
  },
});
