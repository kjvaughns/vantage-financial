/**
 * Canonical link set injected into every email context. Individual sends may
 * override any of these (e.g. a specific evaluation or invitation link).
 */

import {
  AGENT_CLOUD_INVITE_URL,
  DISCORD_INVITE_URL,
  NIPR_URL,
  STATE_REQUIREMENTS_URL,
  XCEL_COURSE_URL,
} from "@/lib/next-steps";
import type { EmailContext } from "./vars";

export const SITE_URL = "https://vantage-financial.net";
export { STATE_REQUIREMENTS_URL };

export function emailLinks(overrides: Partial<EmailContext> = {}): EmailContext {
  return {
    portal_link: `${SITE_URL}/portal`,
    onboarding_link: `${SITE_URL}/portal/onboarding`,
    academy_link: `${SITE_URL}/portal/academy`,
    training_link: `${SITE_URL}/portal/academy`,
    calendar_link: `${SITE_URL}/portal/calendar`,
    preferences_link: `${SITE_URL}/portal/settings`,
    evaluation_link: `${SITE_URL}/evaluation`,
    overview_link: `${SITE_URL}/apply`,
    one_on_one_link: `${SITE_URL}/apply`,
    reschedule_link: `${SITE_URL}/apply`,
    vsl_link: `${SITE_URL}/watch`,
    course_link: XCEL_COURSE_URL,
    discord_link: DISCORD_INVITE_URL,
    agent_cloud_link: AGENT_CLOUD_INVITE_URL,
    state_requirements_link: STATE_REQUIREMENTS_URL,
    nipr_link: NIPR_URL,
    ...overrides,
  };
}
