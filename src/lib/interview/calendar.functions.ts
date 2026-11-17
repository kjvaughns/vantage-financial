import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { canManageCalendar, CALENDAR_ROLES } from "./rules";
const targetSchema = z.object({ ownerId: z.string().uuid().optional() });
const connectionSchema = targetSchema.extend({ username: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/), eventSlug: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/), apiKey: z.string().trim().max(1024).default(""), timezone: z.string().trim().refine((v) => { try { new Intl.DateTimeFormat("en-US", { timeZone: v }); return true; } catch { return false; } }, "Enter a valid timezone"), format: z.enum(["one_on_one", "group"]).default("one_on_one") });
async function authorize(context: { supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>; userId: string }, ownerId?: string) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (error) throw new Error("Could not check calendar permissions.");
  const owner = ownerId || context.userId;
  if (!canManageCalendar(context.userId, (data ?? []).map((r) => r.role), owner)) throw new Error("Only leaders can manage their own calendar; only a super admin can edit another leader's calendar.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [profile, roles] = await Promise.all([supabaseAdmin.from("profiles").select("is_active").eq("id", owner).single(), supabaseAdmin.from("user_roles").select("role").eq("user_id", owner)]);
  if (profile.error || roles.error || !profile.data?.is_active || !roles.data?.some((r) => CALENDAR_ROLES.includes(r.role))) throw new Error("Choose an active leader or manager.");
  return { owner, admin: supabaseAdmin };
}
export const getInterviewCalendarSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => targetSchema.parse(input)).handler(async ({ context, data }) => {
  const { owner, admin } = await authorize(context, data.ownerId);
  const { data: row, error } = await admin.from("interview_calendars").select("id,username,event_slug,timezone,interview_format").eq("owner_id", owner).eq("enabled", true).maybeSingle();
  if (error) throw new Error("Could not load calendar settings.");
  return row ? { id: row.id, username: row.username, eventSlug: row.event_slug, timezone: row.timezone, format: (row.interview_format === "group" ? "group" : "one_on_one") as "group" | "one_on_one", connected: true } : { id: null, username: "", eventSlug: "", timezone: "America/Chicago", format: "one_on_one" as "group" | "one_on_one", connected: false };
});
export const testInterviewCalendar = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => connectionSchema.parse(input)).handler(async ({ context, data }) => {
  const { owner, admin } = await authorize(context, data.ownerId);
  const { decryptApiKey, validateConnection } = await import("./calendar.server");
  let key = data.apiKey;
  if (!key) {
    const { data: row, error } = await admin.from("interview_calendars").select("encrypted_api_key").eq("owner_id", owner).eq("enabled", true).maybeSingle();
    if (error || !row) throw new Error("Enter your Cal.com API key.");
    key = await decryptApiKey(row.encrypted_api_key);
  }
  await validateConnection({ ...data, apiKey: key });
  return { ok: true };
});
export const saveInterviewCalendar = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => connectionSchema.parse(input)).handler(async ({ context, data }) => {
  const { owner, admin } = await authorize(context, data.ownerId);
  const { encryptApiKey, decryptApiKey, validateConnection } = await import("./calendar.server");
  const { data: previous, error } = await admin.from("interview_calendars").select("*").eq("owner_id", owner).eq("enabled", true).maybeSingle();
  if (error) throw new Error("Could not read calendar connection.");
  const apiKey = data.apiKey || (previous ? await decryptApiKey(previous.encrypted_api_key) : "");
  if (!apiKey) throw new Error("Enter your Cal.com API key.");
  const eventTypeId = await validateConnection({ ...data, apiKey });
  const encrypted = await encryptApiKey(apiKey);
  // Atomic replacement retains old calendar versions for existing booking UIDs.
  const { error: saveError } = await admin.rpc("replace_interview_calendar", { _owner: owner, _username: data.username, _slug: data.eventSlug, _event_id: eventTypeId, _timezone: data.timezone, _encrypted_key: encrypted });
  if (saveError) throw new Error("Could not save this calendar. Please try again.");
  const { error: formatError } = await admin.from("interview_calendars").update({ interview_format: data.format }).eq("owner_id", owner).eq("enabled", true);
  if (formatError) throw new Error("Calendar saved, but the interview type could not be saved. Please try again.");
  return { ok: true };
});
export const disconnectInterviewCalendar = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => targetSchema.parse(input)).handler(async ({ context, data }) => {
  const { owner, admin } = await authorize(context, data.ownerId);
  const { error } = await admin.from("interview_calendars").update({ enabled: false }).eq("owner_id", owner).eq("enabled", true);
  if (error) throw new Error("Could not disconnect this calendar.");
  return { ok: true };
});
