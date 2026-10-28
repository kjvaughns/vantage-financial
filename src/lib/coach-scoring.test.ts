import { describe, expect, it } from "vitest";
import { clampScore, expectedPillarsForDay, normalizePillars, overallScore } from "./coach-scoring";

describe("coach scoring", () => {
  it("clamps pillar scores to 1–10", () => {
    expect(clampScore(14)).toBe(10);
    expect(clampScore(0)).toBe(1);
    expect(clampScore("abc")).toBe(1);
    expect(clampScore(7.4)).toBe(7);
  });

  it("overall is the equal-weight average scaled to 100", () => {
    const all8 = normalizePillars(Object.fromEntries(["intro", "needs_analysis", "medical", "social", "bank", "close", "rapport", "tonality", "script"].map((k) => [k, { score: 8 }])));
    expect(overallScore(all8)).toBe(80);
  });

  it("applies pillar weights", () => {
    const s = normalizePillars({ intro: { score: 10 }, needs_analysis: { score: 10 }, medical: { score: 10 }, social: { score: 10 }, bank: { score: 10 }, close: { score: 4 }, rapport: { score: 10 }, tonality: { score: 10 }, script: { score: 10 } });
    // close explicitly weighted 3; intro/needs_analysis/tonality default to 3, rest to 1:
    // (10*14 + 4*3) / 17 = 8.94 → 89
    expect(overallScore(s, { close: 3 })).toBe(89);
  });

  it("zero weight removes a pillar", () => {
    const s = normalizePillars({ intro: { score: 2 } }); // others default to 1
    expect(overallScore(s, { intro: 0 })).toBe(10);
  });

  it("skips pillars the agent never attempted", () => {
    const s = normalizePillars({ intro: { status: "not_attempted", score: 1 }, needs_analysis: { status: "not_attempted" }, medical: { score: 8 }, social: { status: "not_attempted" }, bank: { score: 6 }, close: { status: "not_attempted" }, rapport: { score: 8 }, tonality: { score: 8 }, script: { score: 8 } });
    expect(s.intro.score).toBeNull();
    // medical 8 + bank 6 + rapport 8 + tonality 8*3 + script 8 = 54 / 7 = 7.71 → 77
    expect(overallScore(s)).toBe(77);
  });

  it("expected sections follow the training day", () => {
    expect(expectedPillarsForDay("Monday Intro + Needs Analysis")).toEqual(["intro", "needs_analysis", "rapport", "tonality", "script"]);
    expect(expectedPillarsForDay("Tuesday Medical")).toContain("social");
    expect(expectedPillarsForDay("Wednesday Full call")).toHaveLength(9);
  });
});
