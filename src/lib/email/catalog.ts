/**
 * The Vantage email catalog — every email the platform can send, defined as
 * data (subject + body copy with `{{tokens}}`) so one renderer, one brand
 * shell, and one admin editor cover all of them.
 *
 * Client-safe: pure data. No secrets, no server imports.
 */

import { SCHEDULE_BULLETS, SCHEDULE_SUMMARY } from "@/lib/schedule";
import type { EmailVarKey } from "./vars";

export type EmailAudience = "applicant" | "agent";

export type EmailCategory =
  | "security"
  | "account"
  | "recruiting"
  | "follow_up"
  | "onboarding"
  | "training"
  | "meeting"
  | "announcement"
  | "campaign";

/** Notification preference that gates an optional email. */
export type PrefKey =
  | "recruiting_updates"
  | "applicant_follow_ups"
  | "training_reminders"
  | "meeting_reminders"
  | "agency_announcements"
  | "onboarding_updates";

export interface EmailDetail {
  label: string;
  value: string;
}

export interface EmailBody {
  title: string;
  intro?: string;
  lines?: string[];
  bullets?: string[];
  details?: EmailDetail[];
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  note?: string;
}

export interface EmailTemplateDef {
  name: string;
  label: string;
  audience: EmailAudience;
  category: EmailCategory;
  /** Human description of what fires this email. */
  trigger: string;
  /** Optional emails are gated on this preference. Security emails have none. */
  prefKey?: PrefKey;
  /** Never auto-send — recruiter picks it from the Send Email composer. */
  manualOnly?: boolean;
  subject: string;
  body: EmailBody;
}

const GREET = "Hi {{first_name}},";

function def(d: EmailTemplateDef): EmailTemplateDef {
  return d;
}

/* ------------------------------------------------------------------ */
/* Applicant / recruiting                                              */
/* ------------------------------------------------------------------ */

const applicantTemplates: EmailTemplateDef[] = [
  def({
    name: "application-licensed",
    label: "Application received — licensed",
    audience: "applicant",
    category: "recruiting",
    trigger: "A licensed applicant submits the application",
    subject: "Your Vantage Financial application is in",
    body: {
      title: "Application received",
      intro: GREET,
      lines: [
        "Thanks for applying to {{agency_name}}. Because you're already licensed, the next step is a short interview with our team.",
        "If your time was confirmed on the application, your 1:1 is already booked. Otherwise, use the link below to choose an available time. Watch the opportunity video before we talk so we can focus on your goals, contracting, and next steps.",
      ],
      details: [{ label: "Booked date", value: "{{interview_date}}" }, { label: "Booked time", value: "{{interview_time}}" }],
      ctaLabel: "View or move your interview",
      ctaUrl: "{{reschedule_link}}",
      secondaryCtaLabel: "Watch before your call",
      secondaryCtaUrl: "{{vsl_link}}",
      note: "Questions before then? Just reply to this email.",
    },
  }),
  def({
    name: "application-unlicensed",
    label: "Application received — unlicensed",
    audience: "applicant",
    category: "recruiting",
    trigger: "An unlicensed applicant submits the application",
    subject: "Your Vantage Financial application is in",
    body: {
      title: "Application received",
      intro: GREET,
      lines: [
        "Thanks for applying to {{agency_name}}. If your time was confirmed on the application, your 1:1 interview is already booked. Otherwise, use the link below to choose a time. Watch the opportunity video before we talk so we can focus on your questions.",
      ],
      details: [{ label: "Booked date", value: "{{interview_date}}" }, { label: "Booked time", value: "{{interview_time}}" }],
      bullets: [
        "Watch the opportunity video before your 1:1",
        "Start the pre-licensing course at getlicensed.insuracloud.ai",
        "Check the state requirements before you schedule your exam",
        "Join the Vantage Discord so you're plugged in",
      ],
      ctaLabel: "View or move your interview",
      ctaUrl: "{{reschedule_link}}",
      secondaryCtaLabel: "Watch before your call",
      secondaryCtaUrl: "{{vsl_link}}",
      note: "Course: {{course_link}} · State requirements: {{state_requirements_link}}. Already licensed? Reply so we can update your next steps.",
    },
  }),
  def({
    name: "evaluation-request",
    label: "Evaluation request",
    audience: "applicant",
    category: "recruiting",
    trigger: "A recruiter requests the evaluation from the applicant record",
    subject: "Next step: your Vantage evaluation",
    body: {
      title: "One quick evaluation",
      intro: GREET,
      lines: [
        "Before we move forward, take five minutes to complete your evaluation. It tells us how to set you up for a fast start.",
      ],
      ctaLabel: "Start your evaluation",
      ctaUrl: "{{evaluation_link}}",
    },
  }),
  def({
    name: "interview-confirmation",
    label: "Interview confirmation",
    audience: "applicant",
    category: "recruiting",
    trigger: "A 1:1 interview is booked",
    subject: "You're booked — Vantage interview details",
    body: {
      title: "Your interview is confirmed",
      intro: GREET,
      lines: ["Your 1:1 interview is on the calendar. Watch the opportunity video before our call so we can spend our time on your questions."],
      details: [
        { label: "Date", value: "{{interview_date}}" },
        { label: "Time", value: "{{interview_time}}" },
        { label: "With", value: "{{recruiter_name}}" },
      ],
      ctaLabel: "Watch before your call",
      ctaUrl: "{{vsl_link}}",
      secondaryCtaLabel: "Choose a different time",
      secondaryCtaUrl: "{{reschedule_link}}",
    },
  }),
  def({
    name: "interview-reminder",
    label: "Interview reminder (24h)",
    audience: "applicant",
    category: "recruiting",
    trigger: "24 hours before a scheduled interview",
    subject: "Reminder: your Vantage interview is tomorrow",
    body: {
      title: "See you tomorrow",
      intro: GREET,
      lines: ["Quick reminder about your interview with {{agency_name}}.", "Please watch the short opportunity video before we talk — it covers the basics so we can focus on you."],
      ctaLabel: "Watch before your call",
      ctaUrl: "{{vsl_link}}",
      secondaryCtaLabel: "Move your interview",
      secondaryCtaUrl: "{{reschedule_link}}",
      details: [
        { label: "Date", value: "{{interview_date}}" },
        { label: "Time", value: "{{interview_time}}" },
      ],
      note: "If something came up, use the link above to choose a new time.",
    },
  }),
  def({
    name: "overview-confirmation",
    label: "Interview confirmation — legacy trigger",
    audience: "applicant",
    category: "recruiting",
    trigger: "A 1:1 time is confirmed for an unlicensed applicant",
    subject: "Your Vantage 1:1 interview is confirmed",
    body: {
      title: "Your interview is confirmed",
      intro: GREET,
      lines: ["Watch the opportunity video before our 1:1, then bring your questions."],
      details: [
        { label: "Date", value: "{{overview_date}}" },
        { label: "Time", value: "{{overview_time}}" },
      ],
      ctaLabel: "Watch before your call",
      ctaUrl: "{{vsl_link}}",
      secondaryCtaLabel: "Move your interview",
      secondaryCtaUrl: "{{reschedule_link}}",
    },
  }),
  def({
    name: "overview-reminder",
    label: "Interview reminder (24h) — legacy trigger",
    audience: "applicant",
    category: "recruiting",
    trigger: "24 hours before a scheduled 1:1 interview",
    subject: "Reminder: your Vantage interview is tomorrow",
    body: {
      title: "Your interview is tomorrow",
      intro: GREET,
      lines: ["Watch the opportunity video before our 1:1 so we can focus on you."],
      details: [
        { label: "Date", value: "{{overview_date}}" },
        { label: "Time", value: "{{overview_time}}" },
      ],
      ctaLabel: "Watch before your call",
      ctaUrl: "{{vsl_link}}",
      secondaryCtaLabel: "Move your interview",
      secondaryCtaUrl: "{{reschedule_link}}",
    },
  }),
  def({
    name: "reschedule-confirmation",
    label: "Reschedule confirmation",
    audience: "applicant",
    category: "recruiting",
    trigger: "An applicant chooses a new 1:1 interview time",
    subject: "Updated — your new Vantage time",
    body: {
      title: "Your time has been updated",
      intro: GREET,
      lines: ["No problem. Your 1:1 interview has been updated. Watch the opportunity video before we talk."],
      details: [
        { label: "Date", value: "{{interview_date}}" },
        { label: "Time", value: "{{interview_time}}" },
      ],
      ctaLabel: "Watch before your call",
      ctaUrl: "{{vsl_link}}",
      secondaryCtaLabel: "Move your interview again",
      secondaryCtaUrl: "{{reschedule_link}}",
    },
  }),
  def({
    name: "followup-checkin",
    label: "Follow up",
    audience: "applicant",
    category: "follow_up",
    trigger: "Recruiter follow-up, manual or from a task",
    subject: "Still interested in Vantage?",
    body: {
      title: "Checking in",
      intro: GREET,
      lines: [
        "I wanted to make sure you didn't get stuck. If you're still interested, the next step is quick.",
      ],
      ctaLabel: "Pick a time",
      ctaUrl: "{{reschedule_link}}",
    },
  }),
  def({
    name: "reschedule-followup",
    label: "Reschedule follow up",
    audience: "applicant",
    category: "follow_up",
    trigger: "Manual — applicant cancelled and hasn't rebooked",
    subject: "Let's get you back on the calendar",
    body: {
      title: "Let's find a new time",
      intro: GREET,
      lines: ["Life happens. Grab whatever time works best for you and we'll take it from there."],
      ctaLabel: "Choose a new time",
      ctaUrl: "{{reschedule_link}}",
    },
  }),
  def({
    name: "no-show-followup",
    label: "No show follow up",
    audience: "applicant",
    category: "follow_up",
    trigger: "Status set to No Show or Follow Up — capped 3-touch series",
    prefKey: "applicant_follow_ups",
    subject: "We missed you — grab another time",
    body: {
      title: "We missed you",
      intro: GREET,
      lines: [
        "We had you down for a call and didn't connect. If you're still interested, grab another time and we'll pick up right where we left off.",
        "If the timing isn't right, just reply and let us know — no hard feelings either way.",
        "Please watch the opportunity video before our next call: {{vsl_link}}",
      ],
      ctaLabel: "Pick a new time",
      ctaUrl: "{{reschedule_link}}",
    },
  }),
  def({
    name: "accepted",
    label: "Accepted",
    audience: "applicant",
    category: "recruiting",
    trigger: "Evaluation is completed — applicant is conditionally hired",
    subject: "You've been selected — welcome to Vantage Financial",
    body: {
      title: "You've been selected",
      intro: GREET,
      lines: [
        "Congratulations — you've been selected to join {{agency_name}}. Your recruiter will confirm the right next step for your licensing status.",
        "If you're already licensed, skip pre-licensing and prepare your NPN, carrier appointments, and any downline details for onboarding. If you're not licensed yet, start your pre-licensing course and check your state requirements. Before your 1:1, watch {{vsl_link}}.",
      ],
      bullets: [
        "Licensed: share your NPN with your recruiter and start your Agent Cloud onboarding when invited",
        "Unlicensed: start your course at getlicensed.insuracloud.ai and review state requirements",
        "Join the Vantage Discord and follow the Start Here instructions for your status",
      ],
      details: [
        { label: "Licensing course", value: "{{course_link}}" },
        { label: "Discord", value: "{{discord_link}}" },
        { label: "Your recruiter", value: "{{recruiter_name}}" },
      ],
      ctaLabel: "Join the Vantage Discord",
      ctaUrl: "{{discord_link}}",
      secondaryCtaLabel: "Start pre-licensing (if needed)",
      secondaryCtaUrl: "{{course_link}}",
      note: "Already licensed? You do not need to buy a pre-licensing course. Reply with your NPN so we can get you started.",

    },
  }),
  def({
    name: "welcome-hired",
    label: "Welcome (hired)",
    audience: "applicant",
    category: "onboarding",
    trigger: "Applicant enters onboarding",
    subject: "Welcome to Vantage Financial",
    body: {
      title: "Welcome to the team",
      intro: GREET,
      lines: [
        "Everything you need lives in the agent portal — onboarding checklist, training, resources, and the team calendar.",
      ],
      bullets: [
        "Create your Agent Cloud account",
        "Select the Licensed role in Discord Start Here",
        "Read the Vantage Financial Agent Playbook",
        "Review agent expectations and the weekly schedule",
        "Complete the Vantage Closer Course",
      ],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "licensing-instructions",
    label: "Licensing instructions",
    audience: "applicant",
    category: "onboarding",
    trigger: "Applicant enters the licensing stage",
    subject: "Your licensing next steps",
    body: {
      title: "Let's get you licensed",
      intro: GREET,
      lines: [
        "Your licensing course is the gate to everything else, so start it today and work it daily.",
        "Three steps, in this order: 1) start the Life Insurance Pre Licensing course, 2) check your State Requirements, 3) apply for your license on nipr.com.",
      ],
      bullets: [
        "Life Insurance Pre Licensing — enroll in the course",
        "Study daily — most agents finish in two to three weeks",
        "State Requirements — check the exact steps for your state",
        "Apply for License — apply on nipr.com",
        "Complete fingerprinting and background checks if your state requires them",
        "Tell your recruiter the day you pass",
      ],
      ctaLabel: "Start pre licensing",
      ctaUrl: "{{course_link}}",
      secondaryCtaLabel: "State requirements",
      secondaryCtaUrl: "{{state_requirements_link}}",
      details: [
        { label: "Apply for your license", value: "{{nipr_link}}" },
      ],
    },
  }),
  def({
    name: "licensing-reminder",
    label: "Licensing reminder",
    audience: "applicant",
    category: "onboarding",
    trigger: "Applicant has been in licensing without progress",
    subject: "How's the licensing course going?",
    body: {
      title: "Checking on your course",
      intro: GREET,
      lines: [
        "Quick nudge on your licensing course. Consistent daily study is what gets people through fast.",
        "The order stays the same: finish Life Insurance Pre Licensing, check your State Requirements, then apply for your license on nipr.com — including fingerprinting if your state requires it.",
      ],
      ctaLabel: "Back to your course",
      ctaUrl: "{{course_link}}",
      secondaryCtaLabel: "State requirements",
      secondaryCtaUrl: "{{state_requirements_link}}",
    },
  }),
  def({
    name: "onboarding-invitation",
    label: "Onboarding invitation",
    audience: "applicant",
    category: "onboarding",
    trigger: "Portal account is created for a new agent",
    subject: "Set up your Vantage agent portal",
    body: {
      title: "Your portal account is ready",
      intro: GREET,
      lines: [
        "Set your password and you'll land in your onboarding checklist: Agent Cloud, Discord Licensed role, Agent Playbook, expectations and schedule, Vantage Closer Course, then live training.",
      ],
      ctaLabel: "Set up your account",
      ctaUrl: "{{invitation_link}}",
      note: "This link is unique to you — please don't forward it.",
    },
  }),
  def({
    name: "training-instructions",
    label: "Training instructions",
    audience: "applicant",
    category: "training",
    trigger: "Applicant or agent enters training",
    subject: "Your Vantage training starts now",
    body: {
      title: "Training starts now",
      intro: GREET,
      lines: [
        "Onboarding is done — you're in training. This is where the reps happen, so show up on camera and ready to dial.",
        `Your week: ${SCHEDULE_SUMMARY}`,
        "Finish the Vantage Closer Course if you haven't yet — live training builds directly on it.",
      ],
      bullets: [
        "Join every session from the Discord training room",
        "Camera on, headset ready, notes open",
        "Bring one recorded call to film review each week",
      ],
      ctaLabel: "Open Vantage Academy",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "first-day-reminder",
    label: "First day reminder",
    audience: "applicant",
    category: "onboarding",
    trigger: "Day before an agent's first day",
    subject: "Your first day at Vantage",
    body: {
      title: "Tomorrow's your first day",
      intro: GREET,
      lines: ["Show up ready to dial. Everything you need is in the portal."],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "not-moving-forward",
    label: "Not moving forward",
    audience: "applicant",
    category: "recruiting",
    trigger: "Manual only — recruiter sends from the applicant record",
    manualOnly: true,
    subject: "An update on your Vantage application",
    body: {
      title: "Thank you for your time",
      intro: GREET,
      lines: [
        "After reviewing your application, we're not moving forward at this time. That isn't a judgement on you — it's about fit for where the team is right now.",
        "We appreciate the time you gave us and wish you well.",
      ],
    },
  }),
  def({
    name: "welcome-onboarding",
    label: "Onboarding started",
    audience: "applicant",
    category: "onboarding",
    trigger: "Onboarding checklist is created",
    prefKey: "onboarding_updates",
    subject: "Welcome to Vantage — your onboarding checklist",
    body: {
      title: "Welcome to the team",
      intro: GREET,
      lines: [
        "You're licensed and officially a Vantage agent. First, create your portal account and password using the secure registration button below. Your name, email, phone, and state will already be filled in; you'll only need to confirm your NPN and choose a password.",
        "After registration, follow these onboarding steps in order before live training.",
        "1) Agent Cloud onboarding — create your Agent Cloud account with the Vantage invite link below, and select the upline shown in your portal checklist.",
        "2) Discord Licensed role — in the Vantage Discord, go to Start Here and select Licensed so the licensed agent channels unlock.",
        "3) Read the Vantage Financial Agent Playbook in the Academy Library.",
        `4) Agent expectations and schedule — ${SCHEDULE_SUMMARY}`,
        "5) Complete the Vantage Closer Course before live training starts.",
      ],
      details: [
        { label: "Agent Cloud", value: "{{agent_cloud_link}}" },
        { label: "Discord", value: "{{discord_link}}" },
        { label: "Academy", value: "{{academy_link}}" },
      ],
      secondaryCtaLabel: "Create Agent Cloud account",
      secondaryCtaUrl: "{{agent_cloud_link}}",
      ctaLabel: "Create my agent account",
      ctaUrl: "{{onboarding_link}}",
      note: "This secure registration link is unique to you. If you already created your account, it opens your onboarding checklist instead.",
    },
  }),
  def({
    name: "onboarding-complete",
    label: "Onboarding complete",
    audience: "applicant",
    category: "onboarding",
    trigger: "Agent completes every onboarding step",
    prefKey: "onboarding_updates",
    subject: "Onboarding complete — you're ready",
    body: {
      title: "Onboarding complete",
      intro: GREET,
      lines: ["Agent Cloud, your Discord Licensed role, the Agent Playbook, expectations and schedule, and the Vantage Closer Course are complete. Next is live training, dials, and film review."],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "onboarding-reminder",
    label: "Onboarding reminder",
    audience: "agent",
    category: "onboarding",
    trigger: "Onboarding incomplete after 24h of no progress (capped series)",
    prefKey: "onboarding_updates",
    subject: "Finish your Vantage onboarding",
    body: {
      title: "You're partway there",
      intro: GREET,
      lines: ["A few steps left before you're fully set up."],
      details: [
        { label: "Progress", value: "{{progress}}" },
        { label: "Next step", value: "{{next_step}}" },
      ],
      ctaLabel: "Continue onboarding",
      ctaUrl: "{{onboarding_link}}",
    },
  }),
];

/* ------------------------------------------------------------------ */
/* Agent / account                                                     */
/* ------------------------------------------------------------------ */

const agentTemplates: EmailTemplateDef[] = [
  def({
    name: "portal-invitation",
    label: "Agent portal invitation",
    audience: "agent",
    category: "account",
    trigger: "An invitation is created or resent",
    subject: "You're invited to the Vantage agent portal",
    body: {
      title: "Your invitation",
      intro: GREET,
      lines: ["{{recruiter_name}} invited you to the {{agency_name}} agent portal."],
      ctaLabel: "Accept your invitation",
      ctaUrl: "{{invitation_link}}",
      note: "This invitation is unique to you and expires in 14 days.",
    },
  }),
  def({
    name: "password-changed",
    label: "Password changed",
    audience: "agent",
    category: "security",
    trigger: "An agent changes their password",
    subject: "Your Vantage password was changed",
    body: {
      title: "Password changed",
      intro: GREET,
      lines: [
        "Your portal password was just changed. If that wasn't you, reset it immediately and tell your manager.",
      ],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "password-reset",
    label: "Password reset link",
    audience: "agent",
    category: "security",
    trigger: "Sent by hand when someone can't get into the portal",
    manualOnly: true,
    subject: "Reset your Vantage portal password",
    body: {
      title: "Reset your password",
      intro: GREET,
      lines: [
        "Use the button below to choose a new password for your {{agency_name}} portal account. The link works once and expires in 24 hours.",
      ],
      ctaLabel: "Choose a new password",
      ctaUrl: "{{reset_link}}",
      note: "If you didn't ask for this, you can ignore it — your password stays the same.",
    },
  }),
  def({
    name: "email-changed",
    label: "Email address changed",
    audience: "agent",
    category: "security",
    trigger: "An agent changes their email address",
    subject: "Your Vantage email address was changed",
    body: {
      title: "Email address updated",
      intro: GREET,
      lines: ["Your portal email address was updated. If this wasn't you, contact your manager now."],
    },
  }),
  def({
    name: "profile-updated",
    label: "Profile updated",
    audience: "agent",
    category: "account",
    trigger: "An admin changes an agent's profile details",
    subject: "Your Vantage profile was updated",
    body: {
      title: "Profile updated",
      intro: GREET,
      lines: ["An administrator updated your profile details. Take a look and confirm they're right."],
      ctaLabel: "Review your profile",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "training-assigned",
    label: "Training assigned",
    audience: "agent",
    category: "training",
    trigger: "Required training is assigned",
    prefKey: "training_reminders",
    subject: "New training assigned: {{course_name}}",
    body: {
      title: "New training assigned",
      intro: GREET,
      lines: ["{{course_name}} has been assigned to you."],
      details: [{ label: "Due", value: "{{deadline}}" }],
      ctaLabel: "Continue training",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "training-reminder",
    label: "Training reminder",
    audience: "agent",
    category: "training",
    trigger: "Required training still incomplete before its deadline",
    prefKey: "training_reminders",
    subject: "Reminder: finish {{course_name}}",
    body: {
      title: "Training reminder",
      intro: GREET,
      lines: ["{{course_name}} is still open. The Closer Course is required before live training."],
      details: [{ label: "Due", value: "{{deadline}}" }],
      ctaLabel: "Continue training",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "course-completed",
    label: "Course completed",
    audience: "agent",
    category: "training",
    trigger: "An agent completes a course",
    prefKey: "training_reminders",
    subject: "Nice work — {{course_name}} complete",
    body: {
      title: "Course complete",
      intro: GREET,
      lines: ["You finished {{course_name}}. Keep the momentum going."],
      ctaLabel: "Next lesson",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "certification-passed",
    label: "Certification passed",
    audience: "agent",
    category: "training",
    trigger: "An agent passes a certification quiz",
    prefKey: "training_reminders",
    subject: "Certified — {{course_name}}",
    body: {
      title: "You passed",
      intro: GREET,
      lines: ["You passed {{course_name}} with {{score}}."],
      ctaLabel: "Back to the Academy",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "certification-retake",
    label: "Certification needs retake",
    audience: "agent",
    category: "training",
    trigger: "An agent misses the passing score on a certification",
    prefKey: "training_reminders",
    subject: "One more attempt on {{course_name}}",
    body: {
      title: "Give it another run",
      intro: GREET,
      lines: [
        "You came in at {{score}} on {{course_name}}. Review the lesson and retake it — most people pass on the second attempt.",
      ],
      ctaLabel: "Retake the quiz",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "meeting-reminder",
    label: "Meeting reminder",
    audience: "agent",
    category: "meeting",
    trigger: "24 hours and 1 hour before a calendar event",
    prefKey: "meeting_reminders",
    subject: "Reminder: {{event_name}}",
    body: {
      title: "{{event_name}}",
      intro: GREET,
      lines: ["Here's your reminder."],
      details: [{ label: "When", value: "{{event_when}}" }],
      ctaLabel: "View the calendar",
      ctaUrl: "{{calendar_link}}",
    },
  }),
  def({
    name: "agency-announcement",
    label: "Agency announcement",
    audience: "agent",
    category: "announcement",
    trigger: "An admin sends an announcement",
    prefKey: "agency_announcements",
    subject: "{{subject_line}}",
    body: {
      title: "{{subject_line}}",
      intro: GREET,
      lines: ["{{message}}"],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "important-notification",
    label: "Important agency notification",
    audience: "agent",
    category: "account",
    trigger: "Admin sends a required operational notice",
    subject: "Important: {{subject_line}}",
    body: {
      title: "{{subject_line}}",
      intro: GREET,
      lines: ["{{message}}"],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "manager-notification",
    label: "Manager / trainer notification",
    audience: "agent",
    category: "recruiting",
    trigger: "Something in a manager's downline needs attention",
    prefKey: "recruiting_updates",
    subject: "Vantage: {{subject_line}}",
    body: {
      title: "{{subject_line}}",
      intro: GREET,
      lines: ["{{message}}"],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "applicant-followup-reminder",
    label: "Applicant follow up reminder",
    audience: "agent",
    category: "follow_up",
    trigger: "An applicant needs follow-up today",
    prefKey: "applicant_follow_ups",
    subject: "Follow up with {{applicant_name}}",
    body: {
      title: "Time to follow up",
      intro: GREET,
      lines: ["{{applicant_name}} is waiting on you. A two-minute call beats a week of silence."],
      ctaLabel: "Open the applicant",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "agent-applicant-stage",
    label: "Applicant moved to a new stage",
    audience: "agent",
    category: "recruiting",
    trigger: "One of your applicants progresses to a new stage",
    prefKey: "recruiting_updates",
    subject: "{{applicant_name}} moved to {{stage_name}}",
    body: {
      title: "{{applicant_name}} is now in {{stage_name}}",
      intro: GREET,
      lines: [
        "{{applicant_name}} just moved from {{previous_stage}} to {{stage_name}}.",
        "We already sent them what they need for this step — open their record to see the timeline and add your own touch.",
      ],
      ctaLabel: "Open the applicant",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "new-agent-assigned",
    label: "New agent assigned",
    audience: "agent",
    category: "recruiting",
    trigger: "An agent is placed under a manager",
    prefKey: "recruiting_updates",
    subject: "New agent on your team: {{applicant_name}}",
    body: {
      title: "New agent assigned",
      intro: GREET,
      lines: ["{{applicant_name}} was added to your team. Reach out today and set expectations."],
      ctaLabel: "View your organization",
      ctaUrl: "{{portal_link}}",
    },
  }),
];

/* ------------------------------------------------------------------ */
/* Campaigns                                                           */
/* ------------------------------------------------------------------ */

const campaignTemplates: EmailTemplateDef[] = [
  def({
    name: "campaign-daily-focus",
    label: "Daily Production Focus",
    audience: "agent",
    category: "campaign",
    trigger: "Daily at 7:00 AM CT for subscribed agents",
    subject: "Today's focus",
    body: {
      title: "Today's production focus",
      intro: GREET,
      details: [
        { label: "Target", value: "{{target}}" },
        { label: "Dial hours", value: "{{dial_hours}}" },
      ],
      lines: ["{{mindset}}", "Today's focus: {{focus}}"],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "campaign-weekly-game-plan",
    label: "Weekly Vantage Game Plan",
    audience: "agent",
    category: "campaign",
    trigger: "Mondays at 7:00 AM CT",
    subject: "Your Vantage game plan for the week",
    body: {
      title: "This week's game plan",
      intro: GREET,
      details: [
        { label: "Team meeting", value: "{{meeting_time}}" },
        { label: "Agency training", value: "{{training_time}}" },
        { label: "Film review", value: "{{film_review}}" },
        { label: "Dial expectation", value: "{{dial_expectation}}" },
      ],
      lines: ["{{message}}"],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "campaign-weekly-sales-tip",
    label: "Weekly Sales Tip",
    audience: "agent",
    category: "campaign",
    trigger: "Weekly for subscribed agents",
    subject: "Sales tip: {{tip_title}}",
    body: {
      title: "{{tip_title}}",
      intro: GREET,
      lines: ["{{tip_body}}"],
      ctaLabel: "Study it in the Academy",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "campaign-academy-content",
    label: "New Academy content",
    audience: "agent",
    category: "campaign",
    trigger: "New Academy content is published",
    subject: "New in the Vantage Academy",
    body: {
      title: "New training just dropped",
      intro: GREET,
      lines: ["{{message}}"],
      ctaLabel: "Watch it now",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "campaign-leadership",
    label: "Leadership development",
    audience: "agent",
    category: "campaign",
    trigger: "Weekly for leaders and managers",
    subject: "Leadership note",
    body: {
      title: "Leadership note",
      intro: GREET,
      lines: ["{{message}}"],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
];


/* ------------------------------------------------------------------ */
/* Recruiting journey stages                                           */
/* ------------------------------------------------------------------ */

const stageTemplates: EmailTemplateDef[] = [
  def({
    name: "pre-licensing",
    label: "Pre licensing",
    audience: "applicant",
    category: "recruiting",
    trigger: "Applicant confirms their licensing course purchase (or is moved to Pre Licensing)",
    subject: "You're in pre licensing — here's the plan",
    body: {
      title: "Pre licensing starts now",
      intro: GREET,
      lines: [
        "Your course is the only thing standing between you and getting paid, so treat it like a job.",
        "Start your pre-licensing course at getlicensed.insuracloud.ai and check the state requirements before scheduling your exam. Join the Vantage Discord for support. If you missed your 1:1, choose a new time: {{reschedule_link}}.",
        "Most agents finish in two to three weeks studying an hour or two a day. When you're ready to test, tell your recruiter and we'll get your exam on the calendar.",
      ],
      bullets: [
        "Join the Vantage Discord and complete Start Here as an unlicensed agent",
        "Check state requirements for your exam and license application",
        "Work through your course daily — an hour or two beats a weekend cram",
        "Take the practice exams until you're consistently passing",
        "Check your State Requirements, then apply for your license on nipr.com",
        "Complete fingerprinting and background checks if your state requires them",
        "Message your recruiter the moment you're ready to schedule your state exam",
      ],
      details: [
        { label: "Discord", value: "{{discord_link}}" },
        { label: "Apply for your license", value: "{{nipr_link}}" },
        { label: "Your recruiter", value: "{{recruiter_name}}" },
        { label: "Reach them at", value: "{{recruiter_email}}" },
      ],
      ctaLabel: "Open your course",
      ctaUrl: "{{course_link}}",
      secondaryCtaLabel: "State requirements",
      secondaryCtaUrl: "{{state_requirements_link}}",
      note: "Need help with state-specific steps? Check {{state_requirements_link}} or ask your recruiter.",

    },
  }),
  def({
    name: "state-exam-scheduled",
    label: "State exam scheduled",
    audience: "applicant",
    category: "recruiting",
    trigger: "A recruiter sets the applicant's state exam date",
    subject: "Your state exam is on the calendar",
    body: {
      title: "Your exam is booked",
      intro: GREET,
      lines: [
        "Your state exam is locked in. Between now and then, practice exams are the highest-value thing you can do.",
        "After you pass: check your State Requirements, then apply for your license on nipr.com and complete any fingerprinting requirements if necessary.",
      ],
      details: [
        { label: "Exam", value: "{{exam_when}}" },
        { label: "Testing provider", value: "{{exam_provider}}" },
      ],
      bullets: [
        "Bring two forms of ID and arrive 30 minutes early",
        "Run practice exams until you're passing comfortably",
        "Text your recruiter the second you get your result",
        "Check your State Requirements, then apply for your license on nipr.com",
        "Complete fingerprinting and background checks if your state requires them",
      ],
      ctaLabel: "Back to your course",
      ctaUrl: "{{course_link}}",
      secondaryCtaLabel: "State requirements",
      secondaryCtaUrl: "{{state_requirements_link}}",
    },
  }),
  def({
    name: "state-exam-reminder",
    label: "State exam reminder",
    audience: "applicant",
    category: "recruiting",
    trigger: "Automated exam reminder series (3 days, 1 day, morning of)",
    prefKey: "recruiting_updates",
    subject: "Exam reminder — {{exam_when}}",
    body: {
      title: "Exam reminder",
      intro: GREET,
      lines: [
        "Quick reminder about your state exam. You've got this.",
        "After you pass: check your State Requirements, then apply for your license on nipr.com and complete any fingerprinting requirements if necessary.",
      ],
      details: [
        { label: "Exam", value: "{{exam_when}}" },
        { label: "Testing provider", value: "{{exam_provider}}" },
      ],
      ctaLabel: "State requirements",
      ctaUrl: "{{state_requirements_link}}",
      note: "Two forms of ID, arrive early, and tell {{recruiter_name}} how it goes.",
    },
  }),
  def({
    name: "state-exam-agent-reminder",
    label: "State exam reminder (recruiter)",
    audience: "agent",
    category: "recruiting",
    trigger: "Automated exam reminder series — recruiter copy",
    prefKey: "recruiting_updates",
    subject: "{{applicant_name}} tests {{exam_when}}",
    body: {
      title: "Exam coming up",
      intro: GREET,
      lines: ["One of your applicants has their state exam coming up — a check-in goes a long way."],
      details: [
        { label: "Applicant", value: "{{applicant_name}}" },
        { label: "Exam", value: "{{exam_when}}" },
      ],
    },
  }),
  def({
    name: "licensing-next-steps",
    label: "Licensing next steps",
    audience: "applicant",
    category: "recruiting",
    trigger: "Recruiter marks the state exam passed",
    subject: "You passed — here's what's next",
    body: {
      title: "You passed your exam",
      intro: GREET,
      lines: [
        "Congratulations. Now let's turn that pass into an active license so you can get contracted.",
        "Two steps left: check your State Requirements, then apply for your license on nipr.com — plus fingerprinting if your state requires it.",
      ],
      bullets: [
        "State Requirements — see your state's exact steps",
        "Apply for License — apply on nipr.com",
        "Complete fingerprinting and the background check if your state requires them",
        "Wait for your license and NPN to be issued",
        "Send your NPN to your recruiter the day you get it — that starts onboarding",
      ],
      details: [
        { label: "Your recruiter", value: "{{recruiter_name}}" },
        { label: "Reach them at", value: "{{recruiter_email}}" },
      ],
      ctaLabel: "State requirements",
      ctaUrl: "{{state_requirements_link}}",
      secondaryCtaLabel: "Apply for your license",
      secondaryCtaUrl: "{{nipr_link}}",
      note: "Requirements vary by state — the state requirements page will walk you through yours, and your recruiter is there if you get stuck.",
    },
  }),
  def({
    name: "active-agent",
    label: "Active agent",
    audience: "agent",
    category: "onboarding",
    trigger: "Agent moves to the Active stage",
    subject: "You're officially active at Vantage",
    body: {
      title: "You're active",
      intro: GREET,
      lines: [
        "Onboarding and training are behind you — you're an active Vantage agent. From here it's dials, film review, and reps.",
      ],
      bullets: ["Live dials 10-6 daily", ...SCHEDULE_BULLETS],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
];

/* ------------------------------------------------------------------ */
/* Automated applicant campaigns                                       */
/* ------------------------------------------------------------------ */

const sequenceTemplates: EmailTemplateDef[] = [
  def({
    name: "overview-invite",
    label: "1:1 interview invite",
    audience: "applicant",
    category: "recruiting",
    trigger: "Optional weekly follow-up for new applicants without an interview — 4 weeks max",
    prefKey: "recruiting_updates",
    subject: "Ready to book your Vantage 1:1?",
    body: {
      title: "Let's find a time to talk",
      intro: GREET,
      lines: [
        "You applied to {{agency_name}} but haven't booked your 1:1 yet. Watch the short opportunity video first, then choose a time to talk about your goals and questions.",
      ],
      ctaLabel: "Choose an interview time",
      ctaUrl: "{{reschedule_link}}",
      secondaryCtaLabel: "Watch the opportunity video",
      secondaryCtaUrl: "{{vsl_link}}",
      note: "Questions first? Reply here and {{recruiter_name}} will get back to you.",
    },
  }),
  def({
    name: "licensing-checkin-course",
    label: "Check-in — pre-licensing course",
    audience: "applicant",
    category: "recruiting",
    trigger: "Twice weekly (Tue + Fri) while pre-licensing is in progress",
    prefKey: "recruiting_updates",
    subject: "Quick check-in on your pre-licensing course",
    body: {
      title: "How's the course going?",
      intro: GREET,
      lines: [
        "Checking in on your pre-licensing course. The agents who finish fast do a chapter a day — that's it.",
        "Enroll in the course and tell {{recruiter_name}} where you're at so we can keep you on pace.",
      ],
      bullets: [
        "Knock out one chapter today",
        "Run practice exams as you go",
        "Message your recruiter with any question you get stuck on",
      ],
      ctaLabel: "Open your course",
      ctaUrl: "{{course_link}}",
      secondaryCtaLabel: "Confirm you enrolled",
      secondaryCtaUrl: "{{course_confirm_link}}",
    },
  }),
  def({
    name: "licensing-checkin-exam",
    label: "Check-in — schedule your state exam",
    audience: "applicant",
    category: "recruiting",
    trigger: "Twice weekly (Tue + Fri) once the course is underway and no exam is scheduled",
    prefKey: "recruiting_updates",
    subject: "Have you scheduled your state exam yet?",
    body: {
      title: "Let's get your exam on the calendar",
      intro: GREET,
      lines: [
        "Once your course is close to done, book your state exam — having a date on the calendar is what gets people licensed.",
        "Check your state's exact steps, then schedule. After you pass, you'll apply for your license on nipr.com.",
      ],
      ctaLabel: "State requirements",
      ctaUrl: "{{state_requirements_link}}",
      secondaryCtaLabel: "Apply for your license",
      secondaryCtaUrl: "{{nipr_link}}",
      note: "Send your exam date to {{recruiter_name}} and we'll get you prepped.",
    },
  }),
  def({
    name: "licensing-checkin-training",
    label: "Check-in — course and training progress",
    audience: "applicant",
    category: "training",
    trigger: "Twice weekly (Tue + Fri) once the exam is on the calendar",
    prefKey: "training_reminders",
    subject: "Check-in: training while you wait on your exam",
    body: {
      title: "Keep building while you wait",
      intro: GREET,
      lines: [
        "Your exam is set — nice work. Keep preparing and use the state requirements page to check what comes after you pass. Once licensed and onboarded, you'll complete the Vantage Closer Course before live training.",
      ],
      details: [{ label: "Your exam", value: "{{exam_when}}" }],
      ctaLabel: "State requirements",
      ctaUrl: "{{state_requirements_link}}",
      secondaryCtaLabel: "Join the Discord",
      secondaryCtaUrl: "{{discord_link}}",
    },
  }),
  def({
    name: "interview-reminder-soon",
    label: "Interview reminder (3 hours)",
    audience: "applicant",
    category: "recruiting",
    trigger: "3 hours before the scheduled 1:1 interview",
    prefKey: "recruiting_updates",
    subject: "Today: your Vantage 1:1 at {{interview_time}}",
    body: {
      title: "Happening today",
      intro: GREET,
      lines: ["Your 1:1 is today. Find a quiet spot with a strong signal, and watch the opportunity video before we talk: {{vsl_link}}"],
      details: [
        { label: "Date", value: "{{interview_date}}" },
        { label: "Time", value: "{{interview_time}}" },
        { label: "With", value: "{{recruiter_name}}" },
      ],
      ctaLabel: "Move your interview",
      ctaUrl: "{{reschedule_link}}",
      note: "Something came up? Choose a new day and time using the button above.",
    },
  }),
  def({
    name: "interview-reminder-final",
    label: "Interview reminder (30 minutes)",
    audience: "applicant",
    category: "recruiting",
    trigger: "30 minutes before the scheduled 1:1 interview",
    prefKey: "recruiting_updates",
    subject: "Starting in 30 minutes — {{interview_time}}",
    body: {
      title: "We start in 30 minutes",
      intro: GREET,
      lines: ["Your Vantage 1:1 starts shortly. Use the meeting details in your calendar invitation to join. If you haven't watched the opportunity video yet: {{vsl_link}}"],
      details: [{ label: "Time", value: "{{interview_time}}" }],
      ctaLabel: "Need to move your interview?",
      ctaUrl: "{{reschedule_link}}",
    },
  }),
];

export const EMAIL_TEMPLATE_LIST: EmailTemplateDef[] = [
  ...applicantTemplates,
  ...stageTemplates,
  ...agentTemplates,
  ...campaignTemplates,
  ...sequenceTemplates,
];

export const EMAIL_CATALOG: Record<string, EmailTemplateDef> = Object.fromEntries(
  EMAIL_TEMPLATE_LIST.map((t) => [t.name, t]),
);

export function templateDef(name: string): EmailTemplateDef | undefined {
  return EMAIL_CATALOG[name];
}

/** Agent-audience templates a recruiter may still send by hand from a record. */
const COMPOSER_AGENT_TEMPLATES = new Set(["password-reset"]);

/** Templates a recruiter can pick in the Send Email composer. */
export function composerTemplates(): EmailTemplateDef[] {
  return EMAIL_TEMPLATE_LIST.filter(
    (t) =>
      (t.audience === "applicant" && t.category !== "campaign") ||
      COMPOSER_AGENT_TEMPLATES.has(t.name),
  );
}

/** Variable keys a template actually uses, for the editor's help list. */
export function templateVars(t: EmailTemplateDef): string[] {
  const strings = [
    t.subject,
    t.body.title,
    t.body.intro ?? "",
    ...(t.body.lines ?? []),
    ...(t.body.bullets ?? []),
    ...(t.body.details ?? []).flatMap((d) => [d.label, d.value]),
    t.body.ctaUrl ?? "",
    t.body.note ?? "",
  ].join(" ");
  const found = new Set<string>();
  for (const m of strings.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) found.add(m[1]);
  return [...found] as EmailVarKey[];
}
