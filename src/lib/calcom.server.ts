import type { OverviewSlot } from "@/lib/calendly.server";

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
export async function fetchCalSlots(): Promise<OverviewSlot[]> {
  try {
    const start = new Date(Date.now() + 10 * 60000);
    const end = new Date(Date.now() + 7 * 86400000);
    const qs = new URLSearchParams({
      username: CAL_USERNAME,
      eventTypeSlug: CAL_EVENT_SLUG,
      start: start.toISOString(),
      end: end.toISOString(),
      timeZone: "UTC",
    });
    const res = await fetch(`${CAL_API}/slots?${qs}`, {
      headers: { "cal-api-version": "2024-09-04" },
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
        out.push({ startIso: iso, schedulingUrl: CAL_BOOKING_URL, label: labelFmt.format(new Date(iso)) + " CT", seatsLeft: null });
      }
    }
    return out.sort((a, b) => a.startIso.localeCompare(b.startIso));
  } catch (err) {
    console.error("fetchCalSlots failed", err);
    return [];
  }
}

/** Book the slot directly — no confirmation step for the applicant. */
export async function createCalBooking(input: {
  startIso: string;
  name: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
  timeZone?: string;
}): Promise<{ ok: true; uid: string | null } | { ok: false; error: string }> {
  const key = process.env["CALCOM_API_KEY"];
  if (!key) return { ok: false, error: "Cal.com is not configured" };
  try {
    const res = await fetch(`${CAL_API}/bookings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "cal-api-version": "2024-08-13",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start: new Date(input.startIso).toISOString(),
        username: CAL_USERNAME,
        eventTypeSlug: CAL_EVENT_SLUG,
        attendee: {
          name: input.name,
          email: input.email,
          timeZone: input.timeZone || "America/Chicago",
          ...(input.phone ? { phoneNumber: toE164(input.phone) } : {}),
        },
        ...(input.notes ? { bookingFieldsResponses: { notes: input.notes } } : {}),
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("Cal.com booking failed", res.status, text);
      return { ok: false, error: text.slice(0, 300) };
    }
    const json = JSON.parse(text) as { data?: { uid?: string } };
    return { ok: true, uid: json.data?.uid ?? null };
  } catch (err) {
    console.error("createCalBooking failed", err);
    return { ok: false, error: (err as Error).message };
  }
}

function toE164(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return `+${d}`;
}
