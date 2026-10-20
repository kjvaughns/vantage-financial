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

export type PillarScore = {
  score: number;
  went_well: string;
  to_fix: string;
  better_line: string;
};

export type PillarScores = Record<PillarKey, PillarScore>;

export const DEFAULT_WEIGHT = 1;

/** Clamp to an integer 1–10. Non-numbers become 1. */
export function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.min(10, Math.max(1, Math.round(v)));
}

/** Weighted average of pillar scores scaled to 0–100. Missing/invalid weights count as 1; zero weights are excluded. */
export function overallScore(scores: Partial<Record<PillarKey, { score: number }>>, weights: Partial<Record<string, number>> = {}): number {
  let total = 0;
  let weightSum = 0;
  for (const p of PILLARS) {
    const s = scores[p.key];
    if (!s) continue;
    const raw = weights[p.key];
    const w = typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_WEIGHT;
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
    out[p.key] = {
      score: clampScore(r.score),
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
