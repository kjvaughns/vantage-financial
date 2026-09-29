const GATEWAY_URL = "https://connector-gateway.lovable.dev/calendly";

/** A single bookable overview slot, already resolved to a Calendly booking URL. */
export type OverviewSlot = {
  /** Slot start, ISO-8601 UTC. */
  startIso: string;
  /** Direct Calendly booking URL for this exact slot. */
  schedulingUrl: string;
  /** Human label rendered in the applicant's dropdown (Central time). */
  label: string;
  /** Seats left, when Calendly reports it (group event types). */
  seatsLeft: number | null;
};

type AvailableTime = {
  start_time?: string;
  scheduling_url?: string;
  status?: string;
  invitees_remaining?: number;
};

function headers() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const calendlyKey = process.env["CALENDLY_API_KEY"];
  if (!lovableKey || !calendlyKey) return null;
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": calendlyKey,
  };
}

async function gatewayGet<T>(path: string, h: Record<string, string>): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, { headers: h });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Calendly gateway failed [${res.status}]: ${body}`);
    throw new Error(`Calendly request failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as T;
}

const CENTRAL = "America/Chicago";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CENTRAL,
  weekday: "short",
  hour: "numeric",
  hour12: false,
});

const labelFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CENTRAL,
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function centralParts(iso: string) {
  const parts = partsFmt.formatToParts(new Date(iso));
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "-1");
  return { weekday, hour };
}

/**
 * Fetch the recurring Monday-evening overview slots from Calendly.
 *
 * Calendly caps `event_type_available_times` at a 7-day window, so we walk
 * consecutive weekly windows. Only Monday evening starts (Central) are kept so
 * the dropdown can never offer a time that isn't the weekly overview.
 * Returns [] on any failure — the application form must never be blocked.
 */
export async function fetchOverviewSlots(opts?: { weeks?: number; slug?: string }): Promise<OverviewSlot[]> {
  const h = headers();
  if (!h) return [];
  const weeks = opts?.weeks ?? 1;
  const slug = (opts?.slug ?? "opportunity-meeting").toLowerCase();

  try {
    const me = await gatewayGet<{ resource: { uri: string } }>("/users/me", h);
    const userUri = me.resource.uri;

    const eventTypes = await gatewayGet<{
      collection: Array<{ uri: string; slug?: string; name?: string; active?: boolean }>;
    }>(`/event_types?user=${encodeURIComponent(userUri)}&count=100`, h);

    const active = eventTypes.collection.filter((e) => e.active !== false);
    const eventType = active.find((e) => (e.slug ?? "").toLowerCase() === slug);
    if (!eventType) return [];

    const slots: OverviewSlot[] = [];
    const now = Date.now();

    for (let w = 0; w < weeks; w++) {
      const start = new Date(now + w * 7 * 86400000 + 10 * 60000);
      const end = new Date(now + (w * 7 + 7) * 86400000 - 60000);
      const qs = new URLSearchParams({
        event_type: eventType.uri,
        start_time: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
        end_time: end.toISOString().replace(/\.\d{3}Z$/, "Z"),
      });
      let batch: AvailableTime[] = [];
      try {
        const res = await gatewayGet<{ collection: AvailableTime[] }>(
          `/event_type_available_times?${qs.toString()}`,
          h,
        );
        batch = res.collection ?? [];
      } catch {
        continue;
      }

      for (const t of batch) {
        if (!t.start_time || (t.status && t.status !== "available")) continue;
        if (slots.some((s) => s.startIso === t.start_time)) continue;
        slots.push({
          startIso: t.start_time,
          schedulingUrl: t.scheduling_url ?? "",
          label: labelFmt.format(new Date(t.start_time)) + " CT",
          seatsLeft: typeof t.invitees_remaining === "number" ? t.invitees_remaining : null,
        });
      }
    }

    return slots.sort((a, b) => a.startIso.localeCompare(b.startIso));
  } catch (err) {
    console.error("fetchOverviewSlots failed", err);
    return [];
  }
}

export type CalendlyPrefill = {
  name?: string | null;
  email?: string | null;
  token?: string | null;
  /** Applicant phone — used for phone-call events (Calendly `location`). */
  phone?: string | null;
  /** Recruiter name — answers the "who referred you" question. */
  referrerName?: string | null;
};

/**
 * Build a Calendly URL for a chosen slot, pre-filled with the applicant's
 * details. Calendly requires the invitee to press Schedule themselves — no API
 * can create the booking on their behalf — so this is a one-tap confirm.
 *
 * `kind` selects how the answers map to the event's questions:
 *  - "overview": group Zoom overview — a2 is "Who referred you?"
 *  - "one_on_one": outbound phone call — `location` carries the phone number
 *    and a1 (the free-text prep question) carries the referrer.
 */
export function buildPrefilledUrl(
  baseUrl: string,
  slotIso: string | null,
  prefill: CalendlyPrefill,
  kind: "overview" | "one_on_one" = "overview",
) {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return baseUrl;
  }
  if (slotIso) {
    // Calendly deep-links a specific slot as /<slug>/<ISO start>
    const stamp = slotIso.replace(/\.\d{3}Z$/, "Z");
    if (!/\/\d{4}-\d{2}-\d{2}T/.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/$/, "")}/${stamp}`;
    }
  }
  if (prefill.name) url.searchParams.set("name", prefill.name);
  if (prefill.email) url.searchParams.set("email", prefill.email);
  if (prefill.token) url.searchParams.set("utm_content", prefill.token);
  if (kind === "one_on_one") {
    // Outbound-call events ask for a phone number as the meeting location.
    if (prefill.phone) url.searchParams.set("location", prefill.phone);
    if (prefill.referrerName) url.searchParams.set("a1", `Referred by ${prefill.referrerName}`);
  } else if (prefill.referrerName) {
    url.searchParams.set("a2", prefill.referrerName);
  }
  if (!url.searchParams.has("hide_gdpr_banner")) url.searchParams.set("hide_gdpr_banner", "1");
  return url.toString();
}
