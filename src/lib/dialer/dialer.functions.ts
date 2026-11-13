import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fromSheetList, normalizeLeadTypes, normalizeStates, toSheetList } from "./shared";

export type DialerRequest = {
  id: string; user_id: string; agent_name: string; lead_types: string[]; states: string[];
  status: string; dialer_username: string | null; has_password: boolean; changed_at: string; created_at: string;
};

export const getMyDialer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const [{ data: req, error }, { data: prof }] = await Promise.all([
      supabase.from("dialer_requests").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("first_name, last_name").eq("id", userId).maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    let password: string | null = null;
    let request = req as (DialerRequest & { sheet_row: number | null }) | null;
    if (request) {
      try {
        const { readSheet, locateRow } = await import("./sheets.server");
        const hit = locateRow(await readSheet(), request.sheet_row, request.agent_name);
        if (hit) {
          password = hit.password || null;
          const username = hit.username || null;
          const status = request.status === "inactive" ? "inactive" : username ? "active" : "requested";
          if (username !== request.dialer_username || status !== request.status || hit.row !== request.sheet_row) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await (supabaseAdmin as any).from("dialer_requests").update({
              dialer_username: username, has_password: !!hit.password, status, sheet_row: hit.row,
              last_synced_at: new Date().toISOString(),
            }).eq("id", request.id);
            request = { ...request, dialer_username: username, status, has_password: !!hit.password };
          }
        }
      } catch (e) {
        console.error("[dialer] live sheet read failed", e);
      }
    }
    const defaultName = [prof?.first_name, prof?.last_name].filter(Boolean).join(" ");
    return { request, password, defaultName };
  });

export const saveDialerRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      agent_name: z.string().trim().min(3).max(120),
      lead_types: z.array(z.string()).max(3),
      states: z.array(z.string()).max(51),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
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
    const payload = {
      user_id: userId, agent_name: data.agent_name, lead_types: leadTypes, states, sheet_row: row,
      last_change: existing ? "update" : "new", changed_at: now, updated_at: now,
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
  });

export const listDialerRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await supabase.from("dialer_requests").select("*").order("changed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as DialerRequest[];
  });

async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("is_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Forbidden");
}

export type DialerAgentRow = {
  user_id: string; name: string; email: string | null;
  request: DialerRequest | null; sheet_username: string | null; in_sheet: boolean;
};

/** Every active portal agent, merged with their dialer record and live sheet row. */
export const listDialerAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const [{ data: profs, error: pe }, { data: reqs, error: re }] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name, full_name, email").eq("is_active", true),
      supabase.from("dialer_requests").select("*"),
    ]);
    if (pe) throw new Error(pe.message);
    if (re) throw new Error(re.message);
    let rows: Awaited<ReturnType<typeof import("./sheets.server")["readSheet"]>> = [];
    try { rows = await (await import("./sheets.server")).readSheet(); } catch (e) { console.error("[dialer] sheet read failed", e); }
    const { locateRow } = await import("./sheets.server");
    const byUser = new Map((reqs ?? []).map((r: any) => [r.user_id, r]));
    const out: DialerAgentRow[] = (profs ?? []).map((p: any) => {
      const name = (p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unnamed").trim();
      const req = (byUser.get(p.id) as DialerRequest & { sheet_row: number | null }) ?? null;
      const hit = locateRow(rows, req?.sheet_row ?? null, req?.agent_name ?? name);
      return { user_id: p.id, name, email: p.email, request: req, sheet_username: hit?.username || null, in_sheet: !!hit };
    });
    return out.sort((a, b) => a.name.localeCompare(b.name));
  });

/** Admin: turn dialer access on (linking an existing sheet login if present) or off. */
export const setDialerAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const now = new Date().toISOString();
    const { data: existing } = await admin.from("dialer_requests").select("*").eq("user_id", data.user_id).maybeSingle();
    if (!data.active) {
      if (!existing) return { ok: true };
      const { error } = await admin.from("dialer_requests").update({ status: "inactive", updated_at: now }).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { data: prof } = await supabase.from("profiles").select("first_name, last_name, full_name").eq("id", data.user_id).maybeSingle();
    const name = existing?.agent_name || (prof?.full_name || [prof?.first_name, prof?.last_name].filter(Boolean).join(" ")).trim();
    if (!name) throw new Error("This agent has no name on their profile.");
    const { readSheet, locateRow } = await import("./sheets.server");
    const hit = locateRow(await readSheet(), existing?.sheet_row ?? null, name);
    const payload = {
      user_id: data.user_id, agent_name: name,
      lead_types: existing?.lead_types ?? normalizeLeadTypes(fromSheetList(hit?.leadTypes)),
      states: existing?.states ?? normalizeStates(fromSheetList(hit?.states)),
      sheet_row: hit?.row ?? existing?.sheet_row ?? null,
      dialer_username: hit?.username || null, has_password: !!hit?.password,
      status: hit?.username ? "active" : "requested",
      last_change: existing ? existing.last_change : "admin", changed_at: existing?.changed_at ?? now, updated_at: now,
      last_synced_at: now,
    };
    const { error } = await admin.from("dialer_requests").upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, linked: !!hit?.username };
  });

/** Admin: edit an agent's dialer details; login is written to the sheet (password never stored here). */
export const adminSaveDialer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_id: z.string().uuid(),
    agent_name: z.string().trim().min(3).max(120),
    lead_types: z.array(z.string()).max(3),
    states: z.array(z.string()).max(51),
    username: z.string().trim().max(120),
    password: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const leadTypes = normalizeLeadTypes(data.lead_types);
    const states = normalizeStates(data.states);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: existing } = await admin.from("dialer_requests").select("*").eq("user_id", data.user_id).maybeSingle();
    const { readSheet, locateRow, writeFullRow, appendFullRow } = await import("./sheets.server");
    const hit = locateRow(await readSheet(), existing?.sheet_row ?? null, existing?.agent_name ?? data.agent_name);
    const password = data.password !== undefined && data.password !== "" ? data.password : hit?.password ?? "";
    const values: [string, string, string, string, string] = [data.agent_name, toSheetList(leadTypes), toSheetList(states), data.username, password];
    const row = hit ? (await writeFullRow(hit.row, values), hit.row) : await appendFullRow(values);
    const now = new Date().toISOString();
    const { error } = await admin.from("dialer_requests").upsert({
      user_id: data.user_id, agent_name: data.agent_name, lead_types: leadTypes, states, sheet_row: row,
      dialer_username: data.username || null, has_password: !!password,
      status: existing?.status === "inactive" ? "inactive" : data.username ? "active" : "requested",
      last_change: existing?.last_change ?? "admin", changed_at: existing?.changed_at ?? now, updated_at: now, last_synced_at: now,
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
