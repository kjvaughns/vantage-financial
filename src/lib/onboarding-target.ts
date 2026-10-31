export type OnboardingCatalog = {
  courseById: Record<string, { slug: string | null; status: string }>;
  resourceById: Record<string, { slug: string | null }>;
  recordingById: Record<string, { slug: string | null }>;
};

type LinkedStep = {
  step_key: string;
  action_type: string;
  internal_path: string | null;
  course_id: string | null;
  auto_course_id: string | null;
  resource_id: string | null;
  recording_id: string | null;
};

export type OnboardingTarget = { kind: "course" | "resource" | "presentation"; slug: string };

/** Resolve configured content, including the original generic Closer Course link. */
export function getOnboardingTarget(step: LinkedStep, catalog: OnboardingCatalog): OnboardingTarget | null {
  const legacyCloser = step.step_key === "complete_vantage_closer_course" &&
    step.action_type === "internal" && step.internal_path === "/portal/academy";
  if (step.action_type === "course" || legacyCloser) {
    const id = step.course_id ?? step.auto_course_id;
    const course = id ? catalog.courseById[id] : legacyCloser
      ? Object.values(catalog.courseById).find((c) => c.slug === "vantage-onboarding-course")
      : undefined;
    return course?.slug && course.status !== "draft" ? { kind: "course", slug: course.slug } : null;
  }
  if (step.action_type === "resource") {
    const resource = step.resource_id ? catalog.resourceById[step.resource_id] : undefined;
    return resource?.slug ? { kind: "resource", slug: resource.slug } : null;
  }
  if (step.action_type === "presentation") {
    const recording = step.recording_id ? catalog.recordingById[step.recording_id] : undefined;
    return recording?.slug ? { kind: "presentation", slug: recording.slug } : null;
  }
  return null;
}