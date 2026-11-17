import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export type { OverviewSlot } from "@/lib/calendly.server";
/** Public availability exposes slots and an opaque calendar id, never credentials. */
export const getOverviewSlots = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ recruiterId: z.string().uuid().optional(), token: z.string().min(10).max(128).optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const { calendarForRecruiter, calendarForApplicantToken } = await import("@/lib/interview/calendar.server");
    const { fetchCalSlots } = await import("@/lib/calcom.server");
    const calendar = data.token ? await calendarForApplicantToken(data.token) : await calendarForRecruiter(data.recruiterId);
    return { slots: await fetchCalSlots(calendar), calendarId: calendar.id, format: calendar.format };
  });
