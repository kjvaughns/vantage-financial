import { describe, expect, it } from "vitest";
import { getOnboardingTarget, type OnboardingCatalog } from "./onboarding-target";

const catalog: OnboardingCatalog = {
  courseById: { closer: { slug: "vantage-onboarding-course", status: "published" }, draft: { slug: "draft", status: "draft" } },
  resourceById: { playbook: { slug: "vantage-agent-playbook" } },
  recordingById: { recording: { slug: "vet-call-4" } },
};
const step = { step_key: "example", action_type: "none", internal_path: null, course_id: null, auto_course_id: null, resource_id: null, recording_id: null };

describe("onboarding content destinations", () => {
  it("opens the selected playbook rather than Academy", () => {
    expect(getOnboardingTarget({ ...step, action_type: "resource", resource_id: "playbook" }, catalog)).toEqual({ kind: "resource", slug: "vantage-agent-playbook" });
  });
  it("opens the selected course", () => {
    expect(getOnboardingTarget({ ...step, action_type: "course", course_id: "closer" }, catalog)).toEqual({ kind: "course", slug: "vantage-onboarding-course" });
  });
  it("resolves the legacy Closer Course Academy button to the actual course", () => {
    expect(getOnboardingTarget({ ...step, step_key: "complete_vantage_closer_course", action_type: "internal", internal_path: "/portal/academy" }, catalog)).toEqual({ kind: "course", slug: "vantage-onboarding-course" });
  });
  it("preserves a custom internal page", () => {
    expect(getOnboardingTarget({ ...step, step_key: "complete_vantage_closer_course", action_type: "internal", internal_path: "/portal/training" }, catalog)).toBeNull();
  });
  it("opens the selected recording", () => {
    expect(getOnboardingTarget({ ...step, action_type: "presentation", recording_id: "recording" }, catalog)).toEqual({ kind: "presentation", slug: "vet-call-4" });
  });
  it("does not fabricate destinations for missing or draft content", () => {
    expect(getOnboardingTarget({ ...step, action_type: "resource", resource_id: "missing" }, catalog)).toBeNull();
    expect(getOnboardingTarget({ ...step, action_type: "course", course_id: "draft" }, catalog)).toBeNull();
  });
});