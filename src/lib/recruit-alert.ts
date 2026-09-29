/**
 * Shared shape + formatting for "new recruit" notifications (agent email and
 * the Discord recruiting bot). Client-safe: no secrets, no server-only imports.
 */

export type RecruitAlert = {
  firstName: string;
  lastName: string;
  recruiterName?: string | null;
  licensed: boolean;
  /** Licensed producer bringing their own agents over. */
  hasDownlines?: boolean;
  /** ISO-8601 overview slot they picked, when they picked one. */
  requestedOverviewAt?: string | null;
  wantsOneOnOne?: boolean;
  state?: string | null;
};

/** Monday-overview slot rendered in Central time, the way the team reads it. */
export function formatSlot(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d) + " CT"
  );
}

/** Human label for what the applicant scheduled. */
export function scheduleLabel(
  a: Pick<RecruitAlert, "requestedOverviewAt" | "wantsOneOnOne">,
): string {
  const slot = formatSlot(a.requestedOverviewAt);
  if (slot) return slot;
  if (a.wantsOneOnOne) return "Requested a 1:1 call";
  return "Not scheduled yet";
}
