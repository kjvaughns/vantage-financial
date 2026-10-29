import { describe, expect, it } from "vitest";
import { effectiveApplicantScope } from "./applicant-scope";

describe("applicant organization scope", () => {
  it("includes unassigned company applicants in an admin's organization view", () => {
    expect(effectiveApplicantScope("downline", true)).toBe("all");
  });
  it("keeps a leader's organization restricted to their hierarchy", () => {
    expect(effectiveApplicantScope("downline", false)).toBe("downline");
  });
  it("preserves explicitly selected personal and direct-team filters for admins", () => {
    expect(effectiveApplicantScope("mine", true)).toBe("mine");
    expect(effectiveApplicantScope("direct", true)).toBe("direct");
  });
});