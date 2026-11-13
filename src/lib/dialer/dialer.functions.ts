import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeLeadTypes, normalizeStates, toSheetList } from "./shared";

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
          const status = username ? "active" : "requested";
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
      status: (hit?.username || existing?.dialer_username) ? "active" : "requested",
    };
    const { error } = await (supabaseAdmin as any).from("dialer_requests").upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
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
