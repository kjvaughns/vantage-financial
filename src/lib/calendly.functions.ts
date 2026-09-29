import { createServerFn } from "@tanstack/react-start";
import type { OverviewSlot } from "@/lib/calendly.server";

export type { OverviewSlot };

/**
 * Public: the next few real Monday overview slots straight from Calendly.
 * Never throws — an empty list means "fall back to the plain booking link".
 */
export const getOverviewSlots = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchCalSlots } = await import("@/lib/calcom.server");
  const slots = await fetchCalSlots();
  return { slots };
});
