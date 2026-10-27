import { describe, expect, it } from "vitest";
import { fallback } from "./agency-path.functions";

describe("agency path fallback", () => {
  it("own-brand leader with 11–25 agents → owner", () => {
    expect(fallback({ role: "Agency owner with my own brand", team: "11–25", production: "$100K+", brand: "I want to keep or build my own agency brand" }).recommendation).toBe("owner");
  });
  it("leader with 1–3 agents → builder", () => {
    expect(fallback({ role: "Team leader with downlines", team: "1–3" }).recommendation).toBe("builder");
  });
  it("no downlines → agent", () => {
    expect(fallback({ role: "Agency owner with my own brand", team: "None" }).recommendation).toBe("agent");
  });
});
