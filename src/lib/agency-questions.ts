// Path-specific agency qualifying questions. Shared by the form, server validation,
// alerts and the CRM so every surface shows the same labels.
export type AgencyQuestion = {
  key: string;
  label: string;
  kind: "select" | "multi" | "text" | "yesno";
  options?: readonly string[];
};

const TIMELINE = ["Now", "Within 30 days", "60–90 days", "Just exploring"] as const;

export const AGENCY_QUESTIONS: Record<"builder" | "owner", AgencyQuestion[]> = {
  builder: [
    { key: "active_writers", label: "Licensed downlines actively writing each month", kind: "select", options: ["None yet", "1–3", "4–10", "11–25", "25+"] },
    { key: "current_imo", label: "Who are you contracted with today?", kind: "text" },
    { key: "release_required", label: "Is your team under a non-compete or release requirement?", kind: "select", options: ["Yes", "No", "Not sure"] },
    { key: "lead_spend", label: "What do your agents spend on leads per month?", kind: "select", options: ["$0", "Under $500", "$500–$1,500", "$1,500–$3,000", "$3,000+"] },
    { key: "products", label: "Products your team writes most", kind: "multi", options: ["Final Expense", "Mortgage Protection", "Veteran", "IUL / Annuity", "Other"] },
    { key: "timeline", label: "How soon could you move your team?", kind: "select", options: TIMELINE },
  ],
  owner: [
    { key: "years_in_business", label: "Years in business", kind: "select", options: ["Under 1 year", "1–3 years", "3–5 years", "5+ years"] },
    { key: "current_imo", label: "Current IMO / upline you contract through", kind: "text" },
    { key: "carrier_count", label: "Carrier contracts you hold today", kind: "select", options: ["0–5", "6–10", "11–20", "20+"] },
    { key: "keep_branding", label: "Stay branded as your own agency?", kind: "yesno" },
    { key: "grow_imo", label: "Want to grow into an IMO with agencies under you?", kind: "yesno" },
    { key: "current_tools", label: "Tools you use today", kind: "multi", options: ["CRM", "Dialer", "Contracting tool", "Leaderboard", "Commission tracking", "None"] },
    { key: "timeline", label: "Timeline to switch", kind: "select", options: TIMELINE },
  ],
};

export type AgencyDetails = Record<string, string | string[]>;

/** Returns the labels of unanswered questions (all are required). */
export function missingAgencyDetails(track: "builder" | "owner", d: AgencyDetails): string[] {
  return AGENCY_QUESTIONS[track].filter((q) => {
    const v = d[q.key];
    return Array.isArray(v) ? v.length === 0 : !v || !String(v).trim();
  }).map((q) => q.label.toLowerCase());
}

/** Validates answers against the allowlist; throws on anything unexpected. */
export function cleanAgencyDetails(track: "builder" | "owner", d: AgencyDetails): AgencyDetails {
  const out: AgencyDetails = {};
  for (const q of AGENCY_QUESTIONS[track]) {
    const v = d[q.key];
    if (q.kind === "multi") {
      const arr = Array.isArray(v) ? v : [];
      if (!arr.length || arr.some((x) => !q.options!.includes(x))) throw new Error(`Answer: ${q.label}`);
      out[q.key] = arr;
    } else {
      const s = typeof v === "string" ? v.trim().slice(0, 200) : "";
      if (!s) throw new Error(`Answer: ${q.label}`);
      if (q.kind === "select" && !q.options!.includes(s)) throw new Error(`Answer: ${q.label}`);
      if (q.kind === "yesno" && s !== "Yes" && s !== "No") throw new Error(`Answer: ${q.label}`);
      out[q.key] = s;
    }
  }
  return out;
}

export function agencyDetailLines(track: string | null | undefined, d: unknown): string[] {
  if ((track !== "builder" && track !== "owner") || !d || typeof d !== "object") return [];
  const rec = d as AgencyDetails;
  return AGENCY_QUESTIONS[track].filter((q) => rec[q.key] && String(rec[q.key]).length)
    .map((q) => `${q.label}: ${Array.isArray(rec[q.key]) ? (rec[q.key] as string[]).join(", ") : rec[q.key]}`);
}
