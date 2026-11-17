import type { OverviewSlot } from "@/lib/calendly.server";
import { primaryCalendar, type InterviewCalendar } from "@/lib/interview/calendar.server";
import { bookingPayload } from "@/lib/interview/rules";

const CAL_API = "https://api.cal.com/v2";
export const CAL_USERNAME = "kjvaughns";
export const CAL_EVENT_SLUG = "15min";
export const CAL_BOOKING_URL = `https://cal.com/${CAL_USERNAME}/${CAL_EVENT_SLUG}`;

const labelFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** Open 1:1 interview times for the next 7 days. Returns [] on any failure. */
export async function fetchCalSlots(calendar: InterviewCalendar = primaryCalendar()): Promise<OverviewSlot[]> {
  try {
    const start = new Date(Date.now() + 10 * 60000);
    const end = new Date(Date.now() + 7 * 86400000);
    const qs = new URLSearchParams({
      username: calendar.username,
      eventTypeSlug: calendar.eventSlug,
      start: start.toISOString(),
      end: end.toISOString(),
      timeZone: "UTC",
    });
    const res = await fetch(`${CAL_API}/slots?${qs}`, {
      headers: { "cal-api-version": "2024-09-04", ...(calendar.apiKey ? { Authorization: `Bearer ${calendar.apiKey}` } : {}) },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error("Cal.com slots failed", res.status, await res.text());
      return [];
    }
    const json = (await res.json()) as { data?: Record<string, Array<{ start: string }>> };
    const out: OverviewSlot[] = [];
    for (const day of Object.values(json.data ?? {})) {
      for (const s of day) {
        const iso = new Date(s.start).toISOString();
        out.push({ startIso: iso, schedulingUrl: `https://cal.com/${calendar.username}/${calendar.eventSlug}`, label: labelFmt.format(new Date(iso)) + " CT", seatsLeft: null });
      }
    }
    return out.sort((a, b) => a.startIso.localeCompare(b.startIso));
  } catch (err) {
    console.error("fetchCalSlots failed", err);
    return [];
  }
}

/** Book the slot directly — no confirmation step for the applicant. */
export async function createCalBooking(input: Parameters<typeof bookOnce>[0], calendar: InterviewCalendar = primaryCalendar()) {
  const first = await bookOnce(input, calendar);
  // Cal.com rejects numbers it can't validate — retry without the phone rather than lose the booking.
  if (!first.ok && input.phone && /phone|number/i.test(first.error)) {
    return bookOnce({ ...input, phone: null }, calendar);
  }
  return first;
}

async function bookOnce(input: {
  startIso: string;
  name: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
  licensed?: boolean;
  instagram?: string | null;
  timeZone?: string;
}, calendar: InterviewCalendar): Promise<{ ok: true; uid: string | null; rescheduleUrl: string | null } | { ok: false; error: string }> {
  const key = calendar.apiKey;
  if (!key) return { ok: false, error: "Cal.com is not configured" };
  try {
    const res = await fetch(`${CAL_API}/bookings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "cal-api-version": "2024-08-13",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bookingPayload({ ...input, phone: input.phone ? toE164(input.phone) : null }, calendar)),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("Cal.com booking failed", res.status);
      return { ok: false, error: /phone|number/i.test(text) ? "Phone number was not accepted by Cal.com." : "That time could not be booked. Please choose another time or contact your recruiting team." };
    }
    const json = JSON.parse(text) as { data?: { uid?: string; rescheduleUrl?: string } };
    if (!json.data?.uid) return { ok: false, error: "Cal.com did not confirm this booking. Please choose another time." };
    return { ok: true, uid: json.data.uid, rescheduleUrl: json.data?.rescheduleUrl ?? null };
  } catch (err) {
    console.error("createCalBooking failed", err);
    return { ok: false, error: (err as Error).message };
  }
}

/** Move an existing booking rather than creating a second calendar event. */
export async function rescheduleCalBooking(uid: string, startIso: string, email: string, calendar: InterviewCalendar = primaryCalendar()): Promise<{ ok: true; uid: string } | { ok: false; error: string }> {
  const key = calendar.apiKey;
  if (!key) return { ok: false, error: "Booking is temporarily unavailable. Please reply to your interview email." };
  try {
    const res = await fetch(`${CAL_API}/bookings/${encodeURIComponent(uid)}/reschedule`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "cal-api-version": "2024-08-13", "Content-Type": "application/json" },
      body: JSON.stringify({ start: new Date(startIso).toISOString(), rescheduledBy: email, reschedulingReason: "Applicant selected a new interview time" }),
    });
    if (!res.ok) {
      console.error("Cal.com reschedule failed", res.status, await res.text());
      return { ok: false, error: "That time could not be confirmed. Please select another time or reply to your interview email." };
    }
    const json = await res.json() as { data?: { uid?: string } };
    return { ok: true, uid: json.data?.uid ?? uid };
  } catch (error) {
    console.error("Cal.com reschedule failed", error);
    return { ok: false, error: "We couldn't update your booking. Please try again or reply to your interview email." };
  }
}

function toE164(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return `+${d}`;
}
