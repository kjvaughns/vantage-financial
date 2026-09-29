// Shared onboarding step definitions + progress helper. Used by the CRM
// indicator, the onboarding page, and server functions so the 5 canonical
// steps and their labels stay in one place. (Account setup happens before
// onboarding begins, so there is no "portal account setup" step.)

export type OnboardingStepKey =
  | "agent_cloud_onboarding"
  | "discord_role_update"
  | "read_agent_playbook"
  | "agent_expectations_schedule"
  | "complete_vantage_closer_course";

export const ONBOARDING_STEP_ORDER: OnboardingStepKey[] = [
  "agent_cloud_onboarding",
  "discord_role_update",
  "read_agent_playbook",
  "agent_expectations_schedule",
  "complete_vantage_closer_course",
];

export const ONBOARDING_STEP_LABELS: Record<OnboardingStepKey, string> = {
  agent_cloud_onboarding: "AgentLink contracting",
  discord_role_update: "Update Discord role",
  read_agent_playbook: "Read the Agent Playbook",
  agent_expectations_schedule: "Agent expectations & schedule",
  complete_vantage_closer_course: "Complete the Vantage Closer Course",
};

// Steps an agent self-checks. (The Closer Course step also auto-completes when
// the Academy course is finished.)
export const SELF_CHECK_STEPS: OnboardingStepKey[] = [
  "agent_cloud_onboarding",
  "discord_role_update",
  "read_agent_playbook",
  "agent_expectations_schedule",
  "complete_vantage_closer_course",
];

export type OnboardingStepState = { completed: boolean; completed_at: string | null };
export type OnboardingSteps = Record<OnboardingStepKey, OnboardingStepState>;

/** Canonical freshly-initialized steps (all false). */
export function initialOnboardingSteps(): OnboardingSteps {
  return {
    agent_cloud_onboarding: { completed: false, completed_at: null },
    discord_role_update: { completed: false, completed_at: null },
    read_agent_playbook: { completed: false, completed_at: null },
    agent_expectations_schedule: { completed: false, completed_at: null },
    complete_vantage_closer_course: { completed: false, completed_at: null },
  };
}


/** Count completed steps from a possibly-missing/loosely-typed jsonb value. */
export function onboardingProgress(steps: unknown): { done: number; total: number } {
  const total = ONBOARDING_STEP_ORDER.length;
  if (!steps || typeof steps !== "object") return { done: 0, total };
  const s = steps as Record<string, { completed?: boolean } | undefined>;
  const done = ONBOARDING_STEP_ORDER.filter((k) => s[k]?.completed === true).length;
  return { done, total };
}
