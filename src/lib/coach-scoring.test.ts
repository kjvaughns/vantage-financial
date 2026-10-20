import { describe, expect, it } from "vitest";
import { clampScore, normalizePillars, overallScore } from "./coach-scoring";

describe("coach scoring", () => {
  it("clamps pillar scores to 1–10", () => {
    expect(clampScore(14)).toBe(10);
    expect(clampScore(0)).toBe(1);
    expect(clampScore("abc")).toBe(1);
    expect(clampScore(7.4)).toBe(7);
  });

  it("overall is the equal-weight average scaled to 100", () => {
    const all8 = normalizePillars(Object.fromEntries(["intro", "needs_analysis", "medical", "social", "bank", "close", "rapport", "tonality"].map((k) => [k, { score: 8 }])));
    expect(overallScore(all8)).toBe(80);
  });

  it("applies pillar weights", () => {
    const s = normalizePillars({ intro: { score: 10 }, needs_analysis: { score: 10 }, medical: { score: 10 }, social: { score: 10 }, bank: { score: 10 }, close: { score: 4 }, rapport: { score: 10 }, tonality: { score: 10 } });
    // close explicitly weighted 3; intro/needs_analysis/tonality default to 3, rest to 1:
    // (10*13 + 4*3) / 16 = 8.875 → 89
    expect(overallScore(s, { close: 3 })).toBe(89);
  });

  it("zero weight removes a pillar", () => {
    const s = normalizePillars({ intro: { score: 2 } }); // others default to 1
    expect(overallScore(s, { intro: 0 })).toBe(10);
  });
});
