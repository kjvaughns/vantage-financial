/** Browser-safe Call Coach scoring helpers (pillars, weights, overall score). */

export const PILLARS = [
  { key: "intro", label: "Intro" },
  { key: "needs_analysis", label: "Needs Analysis" },
  { key: "medical", label: "Medical" },
  { key: "social", label: "Social" },
  { key: "bank", label: "Bank" },
  { key: "close", label: "Close" },
  { key: "rapport", label: "Rapport" },
  { key: "tonality", label: "Tonality" },
] as const;

export type PillarKey = (typeof PILLARS)[number]["key"];

export type PillarStatus = "performed" | "partial" | "not_attempted";

export type PillarScore = {
  /** null when the agent never attempted this section — it isn't graded. */
  score: number | null;
  status: PillarStatus;
  /** Short transcript evidence the grader used to decide the status. */
  evidence?: string;
  went_well: string;
  to_fix: string;
  better_line: string;
};

export type PillarScores = Record<PillarKey, PillarScore>;

export const DEFAULT_WEIGHT = 1;

/** Vantage default scoring emphasis: Intro, Needs Analysis and Tonality matter most (per KJ's training). */
export const DEFAULT_WEIGHTS: Record<PillarKey, number> = {
  intro: 3,
  needs_analysis: 3,
  tonality: 3,
  medical: 1,
  social: 1,
  bank: 1,
  close: 1,
  rapport: 1,
};

/** Clamp to an integer 1–10. Non-numbers become 1. */
export function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.min(10, Math.max(1, Math.round(v)));
}

/** Weighted average of pillar scores scaled to 0–100. Missing/invalid weights count as 1; zero weights are excluded. */
export function overallScore(scores: Partial<Record<PillarKey, { score: number | null; status?: string }>>, weights: Partial<Record<string, number>> = {}): number {
  let total = 0;
  let weightSum = 0;
  for (const p of PILLARS) {
    const s = scores[p.key] as { score: number | null; status?: string } | undefined;
    if (!s || s.status === "not_attempted" || typeof s.score !== "number") continue;
    const raw = weights[p.key];
    const w = typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_WEIGHTS[p.key] ?? DEFAULT_WEIGHT;
    if (w === 0) continue;
    total += clampScore(s.score) * w;
    weightSum += w;
  }
  if (!weightSum) return 0;
  return Math.round((total / weightSum) * 10);
}

/** Normalize raw AI output into a complete PillarScores object. */
export function normalizePillars(raw: unknown): PillarScores {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const out = {} as PillarScores;
  for (const p of PILLARS) {
    const r = src[p.key] ?? {};
    const status: PillarStatus = r.status === "not_attempted" || r.status === "partial" ? r.status : "performed";
    out[p.key] = {
      status,
      score: status === "not_attempted" ? null : clampScore(r.score),
      evidence: String(r.evidence ?? "").slice(0, 600),
      went_well: String(r.went_well ?? "").slice(0, 1200),
      to_fix: String(r.to_fix ?? "").slice(0, 1200),
      better_line: String(r.better_line ?? "").slice(0, 1200),
    };
  }
  return out;
}

export function scoreTone(n: number, outOf = 10): "green" | "amber" | "red" {
  const pct = n / outOf;
  return pct >= 0.8 ? "green" : pct >= 0.6 ? "amber" : "red";
}

/** Which script sections a homework day expects, inferred from its label/title.
 *  Monday: Intro + Needs Analysis. Tuesday: + Medical + Social. Later days: the full call. */
export function expectedPillarsForDay(label: string | null | undefined): PillarKey[] {
  const t = (label ?? "").toLowerCase();
  const delivery: PillarKey[] = ["rapport", "tonality"];
  if (/\bmon(day)?\b/.test(t)) return ["intro", "needs_analysis", ...delivery];
  if (/\btue(s|sday)?\b/.test(t)) return ["intro", "needs_analysis", "medical", "social", ...delivery];
  return PILLARS.map((p) => p.key);
}
