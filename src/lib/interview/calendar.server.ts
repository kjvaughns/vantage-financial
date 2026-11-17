import { supabaseAdmin } from "@/integrations/supabase/client.server";
export type InterviewCalendar = { id: string | null; ownerId: string | null; username: string; eventSlug: string; eventTypeId?: number; timezone: string; apiKey: string; custom: boolean };
export function primaryCalendar(): InterviewCalendar {
  return { id: null, ownerId: null, username: "kjvaughns", eventSlug: "15min", timezone: "America/Chicago", apiKey: process.env["CALCOM_API_KEY"] || "", custom: false };
}
async function encryptionKey() {
  const secret = process.env["INTERVIEW_CALENDAR_ENCRYPTION_KEY"];
  if (!secret) throw new Error("Calendar security is not configured.");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptApiKey(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(value));
  return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...new Uint8Array(cipher)))}`;
}
export async function decryptApiKey(value: string) {
  const [iv, ciphertext] = value.split(".");
  if (!iv || !ciphertext) throw new Error("Calendar connection needs to be replaced.");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.from(atob(iv), (c) => c.charCodeAt(0)) }, await encryptionKey(), Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0)));
  return new TextDecoder().decode(plain);
}
export async function calendarById(id: string): Promise<InterviewCalendar> {
  const { data, error } = await supabaseAdmin.from("interview_calendars").select("*").eq("id", id).single();
  if (error || !data) throw new Error("This interview calendar is unavailable. Please contact your team.");
  return { id: data.id, ownerId: data.owner_id, username: data.username, eventSlug: data.event_slug, eventTypeId: data.event_type_id, timezone: data.timezone, apiKey: await decryptApiKey(data.encrypted_api_key), custom: !(data.username === "kjvaughns" && data.event_slug === "15min") };
}
export async function calendarForRecruiter(recruiterId?: string | null): Promise<InterviewCalendar> {
  if (!recruiterId) return primaryCalendar();
  const { data: recruiter, error: recruiterError } = await supabaseAdmin.from("profiles").select("id,is_active,can_receive_applicants").eq("id", recruiterId).maybeSingle();
  if (recruiterError) throw new Error("Could not check your recruiting team.");
  if (!recruiter?.is_active || !recruiter.can_receive_applicants) return primaryCalendar();
  const { data: leader, error } = await supabaseAdmin.rpc("resolve_applicant_upline", { _recruiter: recruiterId });
  if (error) throw new Error("Could not resolve your team's interview calendar.");
  return calendarForLeader(leader);
}
async function calendarForLeader(leader?: string | null): Promise<InterviewCalendar> {
  if (!leader) return primaryCalendar();
  const { data, error } = await supabaseAdmin.from("interview_calendars").select("id").eq("owner_id", leader).eq("enabled", true).maybeSingle();
  if (error) throw new Error("Could not load the interview calendar.");
  return data ? calendarById(data.id) : primaryCalendar();
}
export async function calendarForApplicantToken(token: string, forNewBooking = false): Promise<InterviewCalendar> {
  const { data, error } = await supabaseAdmin.from("applicants").select("interview_calendar_id,scheduled_event_id,assigned_manager_id").eq("confirmation_token", token).is("archived_at", null).maybeSingle();
  if (error || !data) throw new Error("This interview link is unavailable.");
  if (data.interview_calendar_id) return calendarById(data.interview_calendar_id);
  // Legacy bookings were made with the primary calendar. Never re-route a booked interview after hierarchy edits.
  if (data.scheduled_event_id && !forNewBooking) return primaryCalendar();
  return calendarForLeader(data.assigned_manager_id);
}
export async function validateConnection(input: { username: string; eventSlug: string; apiKey: string; timezone: string }) {
  const response = await fetch("https://api.cal.com/v2/event-types", { headers: { Authorization: `Bearer ${input.apiKey}`, "cal-api-version": "2024-06-14" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Cal.com could not verify this key. Check its permissions and expiration.");
  const json = await response.json() as { data?: { eventTypeGroups?: { profile?: { slug?: string }; eventTypes?: { id: number; slug: string; bookingFields?: { slug: string; required?: boolean; type?: string }[] }[] }[] } | { id: number; slug: string; bookingFields?: { slug: string; required?: boolean; type?: string }[] }[] };
  let event: { id: number; slug: string; bookingFields?: { slug: string; required?: boolean; type?: string }[] } | undefined;
  if (Array.isArray(json.data)) event = json.data.find((e) => e.slug === input.eventSlug);
  else event = json.data?.eventTypeGroups?.filter((g) => !g.profile?.slug || g.profile.slug === input.username).flatMap((g) => g.eventTypes ?? []).find((e) => e.slug === input.eventSlug);
  if (!event) throw new Error("That event was not found on this Cal.com account. Check the username and event slug.");
  // The primary company event's known licensing fields are supplied by our booking payload.
  const companyEvent = input.username === "kjvaughns" && input.eventSlug === "15min";
  const supported = ["name", "email", "attendeePhoneNumber", "phone", "notes", "guests", "rescheduleReason", "location", "title"];
  if (companyEvent) supported.push("Recruit-Status", "Instagram-Handle");
  const unsupported = event.bookingFields?.filter((f) => f.required && !supported.includes(f.slug));
  if (unsupported?.length) throw new Error(`Remove required custom event questions before connecting: ${unsupported.map((f) => f.slug).join(", ")}.`);
  // Verify the public username/slug resolves to this same owned event, not another user's event.
  const publicResponse = await fetch(`https://api.cal.com/v2/event-types?${new URLSearchParams({ username: input.username, eventSlug: input.eventSlug })}`, { headers: { "cal-api-version": "2024-06-14" }, signal: AbortSignal.timeout(15000) });
  if (!publicResponse.ok) throw new Error("The public meeting link could not be verified.");
  const publicJson = await publicResponse.json() as { data?: { id: number; slug: string }[] };
  if (!Array.isArray(publicJson.data) || !publicJson.data.some((e) => e.id === event?.id)) throw new Error("This username and event do not match the connected account.");
  const slotsResponse = await fetch(`https://api.cal.com/v2/slots?${new URLSearchParams({ username: input.username, eventTypeSlug: input.eventSlug, start: new Date().toISOString(), end: new Date(Date.now() + 7 * 86400000).toISOString(), timeZone: "UTC" })}`, { headers: { Authorization: `Bearer ${input.apiKey}`, "cal-api-version": "2024-09-04" }, signal: AbortSignal.timeout(15000) });
  if (!slotsResponse.ok) throw new Error("The event was found, but availability could not be read. Check the calendar connection in Cal.com.");
  return event.id;
}
