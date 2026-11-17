export const CALENDAR_ROLES = ["leader", "manager", "admin", "super_admin"];
export function canManageCalendar(actorId: string, roles: string[], ownerId: string) {
  return roles.includes("super_admin") || (actorId === ownerId && roles.some((r) => CALENDAR_ROLES.includes(r)));
}
export function matchesCalendar(shown: string | null, resolved: string | null) {
  return shown === resolved;
}
export function bookingPayload(input: { startIso: string; name: string; email: string; phone?: string | null; notes?: string | null; licensed?: boolean; instagram?: string | null; timeZone?: string }, calendar: { username: string; eventSlug: string; eventTypeId?: number; timezone: string; custom: boolean }) {
  return {
    start: new Date(input.startIso).toISOString(),
    ...(calendar.eventTypeId ? { eventTypeId: calendar.eventTypeId } : { username: calendar.username, eventTypeSlug: calendar.eventSlug }),
    attendee: { name: input.name, email: input.email, timeZone: input.timeZone || calendar.timezone, ...(input.phone ? { phoneNumber: input.phone } : {}) },
    // Company-specific required fields belong only to the company event, not other leaders' events.
    bookingFieldsResponses: { ...(!calendar.custom ? { "Recruit-Status": input.licensed ? "Licensed" : "Unlicensed", ...(input.instagram ? { "Instagram-Handle": input.instagram } : {}) } : {}), ...(input.notes ? { notes: input.notes } : {}) },
  };
}
