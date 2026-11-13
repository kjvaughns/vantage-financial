/** Browser-safe dialer support helpers shared by portal, server and tests. */
export const DIALER_SHEET_ID = "1DX298qEvVA15lHDkxSlQv-zaToomkektdinz6KWPy20";
export const DIALER_SHEET_URL = `https://docs.google.com/spreadsheets/d/${DIALER_SHEET_ID}/edit`;
export const DIALER_SUPPORT_EMAIL = "justin@harborstonefinancialgroup.com";

export const LEAD_TYPES = ["FEX", "VETS", "MP"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];
export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  FEX: "Final Expense",
  VETS: "Veterans",
  MP: "Mortgage Protection",
};

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI",
  "SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
] as const;

/** Normalize + order values the way the sheet dropdowns expect ("FEX, VETS"). */
export function normalizeLeadTypes(input: string[]): LeadType[] {
  const set = new Set(input.map((s) => s.trim().toUpperCase()));
  return LEAD_TYPES.filter((t) => set.has(t));
}
export function normalizeStates(input: string[]): string[] {
  const set = new Set(input.map((s) => s.trim().toUpperCase()));
  return US_STATES.filter((s) => set.has(s));
}
export function toSheetList(values: string[]): string {
  return values.join(", ");
}
export function fromSheetList(cell: string | undefined | null): string[] {
  return (cell ?? "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
}

/** Offset (ms) of America/Chicago from UTC at a given instant. */
function chicagoOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** UTC bounds of the previous Central calendar day relative to `now`. */
export function previousCentralDay(now: Date): { start: Date; end: Date; label: string } {
  const local = new Date(now.getTime() + chicagoOffsetMs(now));
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate();
  const toUtc = (yy: number, mm: number, dd: number) => {
    const guess = new Date(Date.UTC(yy, mm, dd));
    return new Date(guess.getTime() - chicagoOffsetMs(new Date(guess.getTime() + 6 * 3600e3)));
  };
  const start = toUtc(y, m, d - 1);
  const end = toUtc(y, m, d);
  const label = new Date(Date.UTC(y, m, d - 1)).toISOString().slice(0, 10);
  return { start, end, label };
}
