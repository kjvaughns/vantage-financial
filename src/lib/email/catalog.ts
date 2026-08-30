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
        "Pick a time that works and we'll go through the opportunity, comp, and what your first 30 days look like.",
      ],
      ctaLabel: "Book your interview",
      ctaUrl: "{{overview_link}}",
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
        "Thanks for applying to {{agency_name}}. Your next step is our company overview — that's where you'll see exactly how this works before you spend a dollar.",
      ],
      bullets: [
        "Attend the company overview",
        "Start your licensing course when you're ready",
        "Join the Vantage Discord so you're plugged in",
      ],
      ctaLabel: "Confirm your overview",
      ctaUrl: "{{overview_link}}",
      note: "Licensing course: {{course_link}}",
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
    trigger: "An interview is booked (Calendly) for a licensed applicant",
    subject: "You're booked — Vantage interview details",
    body: {
      title: "Your interview is confirmed",
      intro: GREET,
      lines: ["Here are your details. Take the call somewhere quiet with a strong signal."],
      details: [
        { label: "Date", value: "{{interview_date}}" },
        { label: "Time", value: "{{interview_time}}" },
        { label: "With", value: "{{recruiter_name}}" },
      ],
      ctaLabel: "Open your portal",
      ctaUrl: "{{portal_link}}",
      note: "Need to move it? Reply here and we'll sort it out.",
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
      lines: ["Quick reminder about your interview with {{agency_name}}."],
      details: [
        { label: "Date", value: "{{interview_date}}" },
        { label: "Time", value: "{{interview_time}}" },
      ],
      note: "If something came up, reply and we'll reschedule.",
    },
  }),
  def({
    name: "overview-confirmation",
    label: "Overview confirmation",
    audience: "applicant",
    category: "recruiting",
    trigger: "An overview slot is confirmed for an unlicensed applicant",
    subject: "You're registered for the Vantage overview",
    body: {
      title: "Your overview is confirmed",
      intro: GREET,
      lines: ["This is the call where everything makes sense. Show up with questions."],
      details: [
        { label: "Date", value: "{{overview_date}}" },
        { label: "Time", value: "{{overview_time}}" },
      ],
      ctaLabel: "Join the Vantage Discord",
      ctaUrl: "{{discord_link}}",
    },
  }),
  def({
    name: "overview-reminder",
    label: "Overview reminder (24h)",
    audience: "applicant",
    category: "recruiting",
    trigger: "24 hours before a scheduled overview",
    subject: "Reminder: Vantage overview tomorrow",
    body: {
      title: "Your overview is tomorrow",
      intro: GREET,
      lines: ["Here's your reminder for the {{agency_name}} company overview."],
      details: [
        { label: "Date", value: "{{overview_date}}" },
        { label: "Time", value: "{{overview_time}}" },
      ],
    },
  }),
  def({
    name: "reschedule-confirmation",
    label: "Reschedule confirmation",
    audience: "applicant",
    category: "recruiting",
    trigger: "An applicant reschedules through Calendly",
    subject: "Updated — your new Vantage time",
    body: {
      title: "Your time has been updated",
      intro: GREET,
      lines: ["No problem. Here's the new time on our calendar."],
      details: [
        { label: "Date", value: "{{interview_date}}" },
        { label: "Time", value: "{{interview_time}}" },
      ],
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
      ctaUrl: "{{overview_link}}",
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
      ctaUrl: "{{overview_link}}",
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
        "Congratulations — you've been selected to join {{agency_name}}. Everything from here runs on one thing: getting you licensed.",
        "Do these three things today: join the Vantage Discord, work through the Start Here channel as an unlicensed agent, and get your licensing course.",
        "Once you've bought the course, take a screenshot of your confirmation screen and post it in the #unlicensed Discord channel with the caption \"I've got the course\" — then tap the button below so we can move you into pre licensing.",
      ],
      bullets: [
        "Join the Vantage Discord — that's where questions get answered and team sales get posted",
        "Complete Start Here as an unlicensed agent",
        "Get your licensing course (use partner code AFE at checkout)",
        "Screenshot your course confirmation and post it in #unlicensed with \"I've got the course\"",
        "Study daily — most agents finish in two to three weeks",
      ],
      details: [
        { label: "Licensing course", value: "{{course_link}}" },
        { label: "Discord", value: "{{discord_link}}" },
        { label: "Your recruiter", value: "{{recruiter_name}}" },
      ],
      ctaLabel: "I've purchased my course",
      ctaUrl: "{{course_confirm_link}}",
      note: "Bring every question to Discord — that's also where you keep up with team wins and team sales.",

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
        "Three steps, in this order: 1) start the Life Insurance Pre Licensing course with partner code AFE, 2) check your State Requirements, 3) apply for your license on nipr.com.",
      ],
      bullets: [
        "Life Insurance Pre Licensing — enroll with partner code AFE",
        "Study daily — most agents finish in two to three weeks",
        "State Requirements — check the exact steps for your state",
        "Apply for License — apply on nipr.com",
        "Complete fingerprinting and background checks if your state requires them",
        "Tell your recruiter the day you pass",
      ],
      ctaLabel: "Start pre licensing (code AFE)",
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
        "The order stays the same: finish Life Insurance Pre Licensing (partner code AFE), check your State Requirements, then apply for your license on nipr.com — including fingerprinting if your state requires it.",
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
        "Set your password and you'll land straight in your onboarding checklist: Agent Cloud onboarding, your Discord Licensed role, the Agent Playbook, expectations and schedule, then the Vantage Closer Course.",
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
        "After registration, complete these five onboarding steps — most people knock them out in one sitting.",
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
      lines: ["Every step is done. Now it's about reps — training, dials, and film review."],
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
        "If you haven't already: join the Vantage Discord, finish the Start Here channel as an unlicensed agent, and post a screenshot of your course confirmation in #unlicensed with the caption \"I've got the course\".",
        "Most agents finish in two to three weeks studying an hour or two a day. When you're ready to test, tell your recruiter and we'll get your exam on the calendar.",
      ],
      bullets: [
        "Join the Vantage Discord and complete Start Here as an unlicensed agent",
        "Post your course confirmation screenshot in #unlicensed with \"I've got the course\"",
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
      note: "Any question at all goes in Discord — it's also where you keep up with team success and team sales. Licensing cheat sheet: {{cheat_sheet_link}}",

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
    label: "Weekly overview invite",
    audience: "applicant",
    category: "recruiting",
    trigger: "Weekly (Thursday) to new applicants with no overview booked — 4 weeks max",
    prefKey: "recruiting_updates",
    subject: "Come see how {{agency_name}} works — this week's overview",
    body: {
      title: "You haven't been to an overview yet",
      intro: GREET,
      lines: [
        "You applied to {{agency_name}} but haven't sat in on a company overview yet. That's the one call where all of this makes sense — comp, leads, licensing, and what your first 90 days look like.",
        "Pick your time below and you're registered. No cost, no commitment.",
      ],
      ctaLabel: "Register for the overview",
      ctaUrl: "{{overview_link}}",
      secondaryCtaLabel: "Grab a 1-on-1 instead",
      secondaryCtaUrl: "{{one_on_one_link}}",
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
        "Use partner code AFE when you enroll, and tell {{recruiter_name}} where you're at so we can keep you on pace.",
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
        "Your exam is set — nice work. The waiting period is the best time to get through the Vantage Closer Course so you're producing the week you're licensed.",
      ],
      details: [{ label: "Your exam", value: "{{exam_when}}" }],
      ctaLabel: "Open Vantage Academy",
      ctaUrl: "{{academy_link}}",
      secondaryCtaLabel: "Join the Discord",
      secondaryCtaUrl: "{{discord_link}}",
    },
  }),
  def({
    name: "interview-reminder-soon",
    label: "Interview reminder (3 hours)",
    audience: "applicant",
    category: "recruiting",
    trigger: "3 hours before the scheduled overview or interview",
    prefKey: "recruiting_updates",
    subject: "Today: your Vantage overview at {{interview_time}}",
    body: {
      title: "Happening today",
      intro: GREET,
      lines: ["You're on the list for today. Find a quiet spot with a strong signal."],
      details: [
        { label: "Date", value: "{{interview_date}}" },
        { label: "Time", value: "{{interview_time}}" },
        { label: "With", value: "{{recruiter_name}}" },
      ],
      ctaLabel: "Your booking",
      ctaUrl: "{{reschedule_link}}",
      note: "Something came up? Reply and we'll move it.",
    },
  }),
  def({
    name: "interview-reminder-final",
    label: "Interview reminder (30 minutes)",
    audience: "applicant",
    category: "recruiting",
    trigger: "30 minutes before the scheduled overview or interview",
    prefKey: "recruiting_updates",
    subject: "Starting in 30 minutes — {{interview_time}}",
    body: {
      title: "We start in 30 minutes",
      intro: GREET,
      lines: ["Your Vantage call starts shortly. Use the link below to join."],
      details: [{ label: "Time", value: "{{interview_time}}" }],
      ctaLabel: "Join the call",
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

/** Templates a recruiter can pick in the Send Email composer. */
export function composerTemplates(): EmailTemplateDef[] {
  return EMAIL_TEMPLATE_LIST.filter(
    (t) => t.audience === "applicant" && t.category !== "campaign",
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
