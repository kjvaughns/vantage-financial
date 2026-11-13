import { normalizeLeadTypes, normalizeStates, toSheetList } from "./shared";

/** Writes a dialer request to the sheet + record and emails the agent a confirmation.
 *  Callers must already have authorized acting for `userId`. */
export async function submitDialerRequest(supabase: any, userId: string, data: { agent_name: string; lead_types: string[]; states: string[] }) {
    const leadTypes = normalizeLeadTypes(data.lead_types);
    const states = normalizeStates(data.states);
    if (!leadTypes.length) throw new Error("Pick at least one lead type.");
    if (!states.length) throw new Error("Pick at least one state.");
    const { data: existing } = await supabase.from("dialer_requests").select("*").eq("user_id", userId).maybeSingle();
    const { readSheet, locateRow, writeRequestRow, appendRequestRow } = await import("./sheets.server");
    const rows = await readSheet();
    const hit = locateRow(rows, existing?.sheet_row ?? null, existing?.agent_name ?? data.agent_name);
    let row: number;
    if (hit) {
      row = hit.row;
      await writeRequestRow(row, data.agent_name, toSheetList(leadTypes), toSheetList(states));
    } else {
      row = await appendRequestRow(data.agent_name, toSheetList(leadTypes), toSheetList(states));
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    // Baseline = what the agent had before today's (Central) changes, so the digest can show adds/removes.
    const day = (d: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date(d));
    const sameDay = existing?.changed_at && day(existing.changed_at) === day(now) && existing.baseline_states;
    const baseline = !existing ? { baseline_lead_types: null, baseline_states: null }
      : sameDay ? { baseline_lead_types: existing.baseline_lead_types, baseline_states: existing.baseline_states }
      : { baseline_lead_types: existing.lead_types ?? [], baseline_states: existing.states ?? [] };
    const payload = { ...baseline,
      user_id: userId, agent_name: data.agent_name, lead_types: leadTypes, states, sheet_row: row,
      last_change: existing ? "update" : "new", request_status: "requested", changed_at: now, updated_at: now,
      dialer_username: hit?.username || existing?.dialer_username || null,
      has_password: hit ? !!hit.password : existing?.has_password ?? false,
      status: existing?.status === "inactive" ? "inactive" : (hit?.username || existing?.dialer_username) ? "active" : "requested",
    };
    const { error } = await (supabaseAdmin as any).from("dialer_requests").upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    try {
      const { data: prof } = await supabase.from("profiles").select("email, first_name").eq("id", userId).maybeSingle();
      if (prof?.email) {
        const { sendEmail } = await import("@/lib/email/dispatch.server");
        await sendEmail({
          template: "dialer-request-received", to: prof.email, toName: data.agent_name, profileId: userId,
          sendKey: `${userId}:${now}`, ignorePrefs: true,
          context: { first_name: prof.first_name ?? data.agent_name.split(" ")[0], dialer_lead_types: leadTypes.join(", "), dialer_states: states.join(", ") } as any,
        });
      }
    } catch (e) { console.warn("[dialer] confirmation email failed", e); }
    return { ok: true };
}
