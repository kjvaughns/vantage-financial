// Vantage Financial — transactional email templates (Phase 3).
//
// Brand voice: confident, direct, no fluff. Gold/dark HTML built with
// inline styles + tables so it survives real email clients. Links are
// environment-configurable so the templates render correctly once a provider
// is wired; unset links fall back to a safe placeholder.

const GOLD = "#C9A84C";
const BG = "#0a0a0a";
const CARD = "#141414";
const INK = "#F5F1E6";
const MUTED = "#B8B4A8";
const FAINT = "#8C8A84";

export type EmailLinks = {
  overviewUrl: string;
  ownerCalendlyUrl: string;
  courseUrl: string;
  discordInviteUrl: string;
};

export function resolveLinks(): EmailLinks {
  const env = (k: string, fallback: string) =>
    (typeof process !== "undefined" && process.env?.[k]) || fallback;
  return {
    overviewUrl: env("VANTAGE_OVERVIEW_URL", "#"),
    ownerCalendlyUrl: env("VANTAGE_OWNER_CALENDLY_URL", "#"),
    courseUrl: env("VANTAGE_COURSE_URL", "#"),
    discordInviteUrl: env("VANTAGE_DISCORD_INVITE_URL", "#"),
  };
}

function button(href: string, label: string) {
  const disabled = !href || href === "#";
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0"><tr><td style="border-radius:10px;background:${GOLD}">
    <a href="${href}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#141414;text-decoration:none;border-radius:10px${disabled ? ";opacity:0.55" : ""}">${label} &rarr;</a>
  </td></tr></table>`;
}

function layout(inner: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BG};padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${CARD};border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
        <tr><td style="padding:30px 34px 8px 34px">
          <div style="font-family:Arial,Helvetica,sans-serif;letter-spacing:3px;font-size:15px;font-weight:800;color:${GOLD}">VANTAGE FINANCIAL</div>
        </td></tr>
        <tr><td style="padding:8px 34px 30px 34px;font-family:Arial,Helvetica,sans-serif;color:${INK}">
          ${inner}
        </td></tr>
        <tr><td style="padding:20px 34px 30px 34px;border-top:1px solid rgba(255,255,255,0.07)">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${FAINT};line-height:1.6">
            &copy; 2026 Vantage Financial. You're receiving this because you applied to join the Vantage team.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const h1 = (t: string) =>
  `<h1 style="margin:6px 0 14px 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.15;color:${INK}">${t}</h1>`;
const p = (t: string) =>
  `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${MUTED}">${t}</p>`;
const li = (t: string) =>
  `<tr><td style="padding:5px 0;font-size:14.5px;line-height:1.5;color:${INK}"><span style="color:${GOLD};font-weight:700">&#10003;</span>&nbsp;&nbsp;${t}</td></tr>`;

export type TemplateKey =
  | "application_licensed"
  | "application_unlicensed"
  | "welcome_hired"
  | "followup_checkin"
  | "welcome_onboarding"
  | "onboarding_complete";

export type RenderedEmail = { subject: string; html: string };

export type TemplateParams = {
  firstName?: string;
  licensed?: boolean;
  portalLink?: string;
  bookedAt?: string | null;
  confirmationToken?: string;
  links?: EmailLinks;
};

function greet(name?: string) {
  return name && name.trim() ? name.trim() : "there";
}

// EMAIL 1 — Application submitted, LICENSED branch.
export function applicationLicensed(params: TemplateParams): RenderedEmail {
  const L = params.links ?? resolveLinks();
  const inner =
    h1("You're in — here's what happens next") +
    p(`Hey ${greet(params.firstName)}, we've got your application — welcome.`) +
    p(
      `Your next step is the Vantage overview call. If you haven't booked it yet, grab a time here:`,
    ) +
    button(L.overviewUrl, "Book the overview") +
    p(
      `Because you're already licensed, you can also grab time for a quick 1:1 with the team to fast-track things if you'd rather move now:`,
    ) +
    button(L.ownerCalendlyUrl, "Book a 1:1 call") +
    p(`Either way — let's move. See you soon.`);
  return { subject: "You're in — here's what happens next", html: layout(inner) };
}

// EMAIL 2 — Application submitted, UNLICENSED branch.
export function applicationUnlicensed(params: TemplateParams): RenderedEmail {
  const L = params.links ?? resolveLinks();
  const inner =
    h1("You're in — here's your next step") +
    p(`Hey ${greet(params.firstName)}, we've got your application — welcome.`) +
    p(`Your next step is the Vantage overview call. Book your seat here:`) +
    button(L.overviewUrl, "Book the overview") +
    p(
      `Don't wait on us to get moving — you can get a head start on licensing today. Start the approved course now so you're ahead of the game:`,
    ) +
    button(L.courseUrl, "Start the licensing course") +
    p(
      `After the overview, if it's a fit, we'll send you a short form to officially join the team. Let's get to work.`,
    );
  return { subject: "You're in — here's your next step", html: layout(inner) };
}

// EMAIL 3 — Evaluation submitted / auto-hire fires. Branches on licensing.
export function welcomeHired(params: TemplateParams): RenderedEmail {
  const L = params.links ?? resolveLinks();
  let body: string;
  if (params.licensed) {
    body =
      p(
        `Congrats ${greet(params.firstName)} — you're officially on the Vantage team. This is the start of something big.`,
      ) +
      p(
        `Since you're already licensed, your next step is contracting paperwork. Someone from the team will follow up shortly with those details — keep an eye on your inbox and phone.`,
      );
  } else {
    body =
      p(
        `Congrats ${greet(params.firstName)} — you're officially on the Vantage team. This is the start of something big.`,
      ) +
      p(
        `Your one job right now: get licensed. If you haven't grabbed your course yet, do it today:`,
      ) +
      button(L.courseUrl, "Get your course") +
      p(
        `Once you're in the course, post a screenshot in our <strong style="color:${INK}">#unlicensed</strong> Discord channel with the caption <em>"I got the course"</em> so we can track your progress:`,
      ) +
      button(L.discordInviteUrl, "Join the Discord") +
      p(`We'll check in with you every week until you're licensed. Let's get it.`);
  }
  return { subject: "Welcome to Vantage — you're officially on the team", html: layout(h1("Welcome to Vantage — you're officially on the team") + body) };
}

// EMAIL 4 — Manual pre-licensing follow-up nudge.
export function followupCheckin(params: TemplateParams): RenderedEmail {
  const L = params.links ?? resolveLinks();
  const inner =
    h1("Quick check-in — how's the course going?") +
    p(`Hey ${greet(params.firstName)}, checking in on your licensing progress.`) +
    p(`Where are you at with the course right now? A few quick things:`) +
    `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:4px 0 14px 0">` +
    li("Still working through the material? Keep the momentum going.") +
    li('Haven\'t posted in the #unlicensed Discord yet? Drop your "I got the course" screenshot.') +
    li("Stuck on anything? Just reply to this email — we've got you.") +
    `</table>` +
    button(L.discordInviteUrl, "Open the Discord") +
    p(`You're closer than you think. Let's keep pushing.`);
  return { subject: "Quick check-in — how's the course going?", html: layout(inner) };
}

// ONBOARDING EMAIL 1 — stage becomes "Onboarding".
export function welcomeOnboarding(params: TemplateParams): RenderedEmail {
  const portal = params.portalLink && params.portalLink !== "#" ? params.portalLink : "#";
  const inner =
    h1("Welcome to the team — let's get you set up") +
    p(
      `Congrats ${greet(params.firstName)} — you're officially on board as a licensed Vantage agent. Welcome.`,
    ) +
    p(
      `Your first stop is the agent portal. That's where you'll find your full onboarding checklist — log in and knock it out:`,
    ) +
    button(portal, "Open your portal") +
    p(`Here's what's waiting for you, five quick steps:`) +
    `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:4px 0 14px 0">` +
    li("Agent Cloud onboarding") +
    li("Discord Licensed role") +
    li("Read the Agent Playbook") +
    li("Expectations & schedule") +
    li("Vantage Closer Course") +
    `</table>` +
    p(`Knock these out and you're fully onboarded. Let's build.`);
  return { subject: "Welcome to the team — let's get you set up", html: layout(inner) };
}

// ONBOARDING EMAIL 2 — all 4 onboarding steps complete.
export function onboardingComplete(params: TemplateParams): RenderedEmail {
  const inner =
    h1("You're fully onboarded — welcome to training") +
    p(
      `Nice work, ${greet(params.firstName)} — every onboarding step is done. You're officially set up and a real part of the Vantage team.`,
    ) +
    p(
      `Next up is training. Your training path will be available in the portal shortly — we'll let you know the moment it's live.`,
    ) +
    p(`Welcome aboard. This is where it gets good.`);
  return { subject: "You're fully onboarded — welcome to training", html: layout(inner) };
}

export function render(key: TemplateKey, params: TemplateParams): RenderedEmail {
  switch (key) {
    case "application_licensed":
      return applicationLicensed(params);
    case "application_unlicensed":
      return applicationUnlicensed(params);
    case "welcome_hired":
      return welcomeHired(params);
    case "followup_checkin":
      return followupCheckin(params);
    case "welcome_onboarding":
      return welcomeOnboarding(params);
    case "onboarding_complete":
      return onboardingComplete(params);
  }
}
