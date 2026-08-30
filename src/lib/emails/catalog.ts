// Catalog of recruiter-composable applicant emails. These are plain
// subject/body templates with {{placeholders}} — the Send Email composer fills
// them in, lets the recruiter preview + edit, and sends. Unlike the fixed
// transactional templates in ./templates.ts (branded React-Email components for
// automated sends), these are free-form and editable per send.
//
// Supported placeholders (substituted by the composer before send):
//   {{first_name}} {{last_name}} {{full_name}} {{evaluation_link}} {{portal_link}}

import {
  DISCORD_INVITE_URL,
  INSTAGRAM_URL,
  NIPR_URL,
  STATE_REQUIREMENTS_URL,
  XCEL_COURSE_URL,
  XCEL_PARTNER_CODE,
} from "@/lib/next-steps";
import { SCHEDULE_SUMMARY } from "@/lib/schedule";

export type ApplicantEmailTemplate = {
  key: string;
  label: string;
  subject: string;
  body: string;
};

export const APPLICANT_EMAIL_TEMPLATES: ApplicantEmailTemplate[] = [
  {
    key: "evaluation_request",
    label: "Evaluation Request",
    subject: "Next step with Vantage Financial",
    body: `Hi {{first_name}},\n\nThanks for your interest in Vantage Financial. The next step is a short evaluation so we can learn more about your goals.\n\nComplete it here: {{evaluation_link}}\n\nIt only takes a few minutes. Reply to this email if you have any questions.\n\nJoin the Vantage Discord — that's where training, announcements, and the team live: ${DISCORD_INVITE_URL}\n\n— The Vantage Team`,
  },
  {
    key: "interview_confirmation",
    label: "Interview Confirmation",
    subject: "Your Vantage interview is confirmed",
    body: `Hi {{first_name}},\n\nYour interview with Vantage Financial is confirmed. We're looking forward to speaking with you.\n\nIf anything changes, just reply to this email and we'll get you rescheduled.\n\nJoin the Vantage Discord — that's where training, announcements, and the team live: ${DISCORD_INVITE_URL}\n\n— The Vantage Team`,
  },
  {
    key: "interview_reminder",
    label: "Interview Reminder",
    subject: "Reminder: your Vantage interview",
    body: `Hi {{first_name}},\n\nThis is a friendly reminder about your upcoming interview with Vantage Financial. Please be on time and ready to talk through your goals.\n\nSee you soon,\n— The Vantage Team`,
  },
  {
    key: "overview_confirmation",
    label: "Overview Confirmation",
    subject: "Your Vantage overview is booked",
    body: `Hi {{first_name}},\n\nYour Vantage Financial overview is booked. We'll walk you through how we work and what your path could look like.\n\nIf you need to reschedule, reply and we'll sort it out.\n\nJoin the Vantage Discord — that's where training, announcements, and the team live: ${DISCORD_INVITE_URL}\n\n— The Vantage Team`,
  },
  {
    key: "overview_reminder",
    label: "Overview Reminder",
    subject: "Reminder: your Vantage overview",
    body: `Hi {{first_name}},\n\nJust a reminder about your upcoming Vantage overview. Looking forward to it!\n\nJoin the Vantage Discord — that's where training, announcements, and the team live: ${DISCORD_INVITE_URL}\n\n— The Vantage Team`,
  },
  {
    key: "follow_up",
    label: "Follow Up",
    subject: "Checking in from Vantage Financial",
    body: `Hi {{first_name}},\n\nJust checking in to see where you're at and whether you have any questions about joining Vantage Financial. Happy to help however I can.\n\nJoin the Vantage Discord — that's where training, announcements, and the team live: ${DISCORD_INVITE_URL}\n\n— The Vantage Team`,
  },
  {
    key: "reschedule_follow_up",
    label: "Reschedule / Follow Up",
    subject: "Let's find a new time",
    body: `Hi {{first_name}},\n\nNo problem on the reschedule — let's find a time that works better for you. Reply with a couple of windows that fit your schedule and we'll lock it in.\n\nJoin the Vantage Discord — that's where training, announcements, and the team live: ${DISCORD_INVITE_URL}\n\n— The Vantage Team`,
  },
  {
    key: "accepted",
    label: "Accepted",
    subject: "Welcome to Vantage Financial!",
    body: `Hi {{first_name}},\n\nCongratulations — you're in! We're excited to have you on the team. We'll be in touch shortly with your next steps.\n\nJoin the Vantage Discord — that's where training, announcements, and the team live: ${DISCORD_INVITE_URL}\n\n— The Vantage Team`,
  },
  {
    key: "welcome",
    label: "Welcome Email",
    subject: "Welcome to Vantage Financial",
    body: `Hi {{first_name}},\n\nWelcome to Vantage Financial. You can access your portal here: {{portal_link}}\n\nWe're glad you're here and we're rooting for your success.\n\nJoin the Vantage Discord — that's where training, announcements, and the team live: ${DISCORD_INVITE_URL}\n\n— The Vantage Team`,
  },
  {
    key: "licensing_instructions",
    label: "Licensing Instructions",
    subject: "Getting licensed — your next steps",
    body: `Hi {{first_name}},\n\nHere's how to get your license so you can start writing business:\n\n1. Life Insurance Pre Licensing — ${XCEL_COURSE_URL} (partner code: ${XCEL_PARTNER_CODE})\n2. Schedule and pass your state exam.\n3. State Requirements — ${STATE_REQUIREMENTS_URL}\n4. Apply for License — ${NIPR_URL}\n5. Send us your NPN once you're licensed.\n\nReply with any questions — we'll check in each week until you're licensed.\n\nJoin the Vantage Discord — that's where training, announcements, and the team live: ${DISCORD_INVITE_URL}\n\n— The Vantage Team`,
  },
  {
    key: "onboarding_invitation",
    label: "Onboarding Invitation",
    subject: "Start your Vantage onboarding",
    body: `Hi {{first_name}},\n\nYou're ready to onboard! Set up your portal account and work through your onboarding checklist here: {{portal_link}}\n\nEach step is short and clearly laid out. Reach out anytime if you get stuck.\n\nJoin the Vantage Discord — that's where training, announcements, and the team live: ${DISCORD_INVITE_URL}\n\n— The Vantage Team`,
  },
  {
    key: "resend_welcome",
    label: "Resend Welcome Email",
    subject: "Your Vantage welcome — resent",
    body: `Hi {{first_name}},\n\nResending your welcome details in case the first one got buried. Your portal is here: {{portal_link}}\n\nJoin the Vantage Discord — that's where training, announcements, and the team live: ${DISCORD_INVITE_URL}\n\n— The Vantage Team`,
  },
  {
    key: "resend_onboarding",
    label: "Resend Onboarding Email",
    subject: "Your Vantage onboarding — resent",
    body: `Hi {{first_name}},\n\nResending your onboarding link. Pick up your checklist here: {{portal_link}}\n\nJoin the Vantage Discord — that's where training, announcements, and the team live: ${DISCORD_INVITE_URL}\n\n— The Vantage Team`,
  },
  {
    key: "training_instructions",
    label: "Training Instructions",
    subject: "Your Vantage training schedule",
    body: `Hi {{first_name}},\n\nHere's what to expect for training: ${SCHEDULE_SUMMARY}\n\nCome ready to learn and take notes.\n\nJoin the Vantage Discord — that's where training, announcements, and the team live: ${DISCORD_INVITE_URL}\n\nFollow the team on Instagram: ${INSTAGRAM_URL}\n\n— The Vantage Team`,
  },
  {
    key: "not_moving_forward",
    label: "Not Moving Forward",
    subject: "An update on your Vantage application",
    body: `Hi {{first_name}},\n\nThank you for your interest in Vantage Financial and for the time you invested. After review, we won't be moving forward at this time.\n\nWe wish you the very best going forward.\n\n— The Vantage Team`,
  },
];

/** Substitute {{placeholders}} in a string from a values map. */
export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => values[k] ?? "");
}
