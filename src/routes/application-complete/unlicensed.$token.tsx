import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PublicShell } from "@/components/vantage/brand";
import { trackApplicationLead } from "@/lib/meta-pixel";
import {
  DISCORD_INVITE_URL,
  NIPR_URL,
  STATE_REQUIREMENTS_URL,
  XCEL_COURSE_URL,
  XCEL_PARTNER_CODE,
} from "@/lib/next-steps";
import {
  getOverviewBooking,
  getSchedulingContext,
  markScheduled,
} from "@/lib/applications.functions";

export const Route = createFileRoute("/application-complete/unlicensed/$token")({
  head: () => ({
    meta: [
      { title: "You're in — here's your next step" },
      { name: "description", content: "Your Vantage application is in. Here's what happens next." },
      { property: "og:title", content: "You're in — here's your next step" },
      {
        property: "og:description",
        content: "Book your overview and get a head start on licensing.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => {
    const ctx = await getSchedulingContext({ data: { token: params.token } });
    return { ctx };
  },
  component: UnlicensedComplete,
});

function UnlicensedComplete() {
  const { ctx } = Route.useLoaderData();
  const { token } = Route.useParams();
  const mark = useServerFn(markScheduled);
  const resolveBooking = useServerFn(getOverviewBooking);
  const [firstName, setFirstName] = useState(ctx.first_name || "there");
  const [booked, setBooked] = useState(false);
  const [copied, setCopied] = useState(false);

  // Deep-link the exact Monday slot they chose on the application, pre-filled
  // with their name, email and referrer. Calendly requires the final confirm tap.
  const bookingQuery = useQuery({
    queryKey: ["overview-booking", token],
    queryFn: () => resolveBooking({ data: { token, base_url: ctx.calendly_url ?? "" } }),
    enabled: ctx.found,
    retry: false,
  });

  // Fire the Meta Pixel conversion on success-page load.
  useEffect(() => {
    trackApplicationLead(token, false);
  }, [token]);

  useEffect(() => {
    if (!ctx.first_name) {
      setFirstName(sessionStorage.getItem("vantage_applicant_first") || "there");
    }
  }, [ctx.first_name]);

  if (!ctx.found) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-[720px] px-6 pt-24 pb-24 text-center md:px-8">
          <h1 className="font-display text-[clamp(36px,6vw,58px)] leading-none">Link expired</h1>
          <p className="mt-4 text-vantage-muted">
            We couldn't find your application. Please re-apply.
          </p>
          <div className="mt-6">
            <Link to="/apply" className="vantage-btn-primary px-6 py-3.5">
              Start over →
            </Link>
          </div>
        </div>
      </PublicShell>
    );
  }

  // Unlicensed branch: no embedded Calendly. Everyone either confirms the Monday
  // overview seat they picked, or — when no date worked — books a 1:1 call with
  // the nearest leader above their recruiter. They stay on this page either way.
  const wantsOneOnOne = bookingQuery.data?.wants_one_on_one ?? false;
  const oneOnOneUrl = bookingQuery.data?.one_on_one_url ?? null;
  const chosenIso = bookingQuery.data?.requested_overview_at ?? null;
  const overviewUrl = bookingQuery.data?.url || ctx.calendly_url || null;
  const bookingUrl = wantsOneOnOne ? oneOnOneUrl : overviewUrl;
  const chosenLabel = chosenIso
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(chosenIso)) + " CT"
    : null;

  const heading = wantsOneOnOne
    ? "Book a 1:1 call"
    : chosenLabel
      ? "Confirm your overview seat"
      : "Book your Vantage overview";
  const blurb = wantsOneOnOne
    ? "None of the Monday overview dates worked for you, so grab a time for a 1:1 call with a Vantage team leader. Your details are already filled in."
    : chosenLabel
      ? `You picked ${chosenLabel}. Your details are already filled in — one tap locks in your seat.`
      : "Monday nights, 7:00 PM CT / 8:00 PM ET. This is where we walk you through how it all works and what's next.";

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(XCEL_PARTNER_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-[820px] px-6 pt-14 pb-24 md:px-8">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-vantage-gold text-[26px] text-vantage-card shadow-[0_0_40px_rgba(201,168,76,0.5)]">
            ✓
          </div>
          <div className="vantage-eyebrow-pill mb-4 inline-flex">Application received</div>
          <h1 className="font-display text-[clamp(36px,6vw,58px)] leading-[0.96]">
            You're in, {firstName} — here's your next step
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-relaxed text-vantage-muted">
            We've got your application. The next step is your call with us — and you can get a head
            start on licensing today so you're never waiting on us to move.
          </p>
        </div>

        {/* Primary next step — confirm the overview seat, or book a 1:1 */}
        <div className="vantage-card vantage-card-gold mt-10 flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <div className="font-display text-[24px] leading-tight text-vantage-ivory">
              {booked ? "You're booked — see you there" : heading}
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-vantage-muted">
              {booked
                ? "Check your email for the calendar invite. Keep working through the steps below in the meantime."
                : blurb}
            </p>
          </div>
          {bookingUrl ? (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => {
                setBooked(true);
                // best-effort: record that they were routed to book
                mark({ data: { token } }).catch(() => {});
              }}
              className="vantage-btn-primary flex-none px-6 py-3.5 text-[15px]"
            >
              {booked
                ? "Reschedule →"
                : wantsOneOnOne
                  ? "Book my 1:1 call →"
                  : chosenLabel
                    ? "Confirm my seat →"
                    : "Book the overview →"}
            </a>
          ) : (
            <span className="flex-none text-[13px] text-vantage-faint">
              We'll email you the booking link shortly.
            </span>
          )}
        </div>

        {/* Head start: licensing course + community */}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="vantage-card flex flex-col gap-3 p-6">
            <div className="font-display text-[20px] leading-tight text-vantage-ivory">
              Start your pre-licensing course
            </div>
            <p className="text-[13.5px] leading-relaxed text-vantage-dim">
              Life insurance pre-licensing through Xcel Solutions. Use our partner code at checkout
              for the discounted rate.
            </p>
            <button
              onClick={copyCode}
              className="flex items-center justify-between gap-3 rounded-[10px] border border-vantage-gold/40 bg-vantage-gold/[0.08] px-4 py-2.5 text-left transition hover:border-vantage-gold"
            >
              <span className="text-[12px] uppercase tracking-[0.08em] text-vantage-muted">
                Partner code
              </span>
              <span className="font-display text-[18px] tracking-wide text-vantage-gold">
                {XCEL_PARTNER_CODE}
              </span>
              <span className="text-[12px] text-vantage-faint">{copied ? "Copied" : "Copy"}</span>
            </button>
            <a
              href={XCEL_COURSE_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="vantage-btn-ghost mt-auto px-5 py-3 text-center text-[14px]"
            >
              Open the course →
            </a>
          </div>

          <div className="vantage-card flex flex-col gap-3 p-6">
            <div className="font-display text-[20px] leading-tight text-vantage-ivory">
              Get licensed in your state
            </div>
            <p className="text-[13.5px] leading-relaxed text-vantage-dim">
              Check your state requirements, then apply for your license on NIPR — plus
              fingerprinting if your state requires it.
            </p>
            <a
              href={STATE_REQUIREMENTS_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="vantage-btn-ghost px-5 py-3 text-center text-[14px]"
            >
              State requirements →
            </a>
            <a
              href={NIPR_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="vantage-btn-ghost mt-auto px-5 py-3 text-center text-[14px]"
            >
              Apply for license →
            </a>
          </div>

          <div className="vantage-card flex flex-col gap-3 p-6">
            <div className="font-display text-[20px] leading-tight text-vantage-ivory">
              Join the Vantage Discord
            </div>
            <p className="text-[13.5px] leading-relaxed text-vantage-dim">
              This is where the team lives — training, announcements, and the people who'll help you
              get licensed and producing fast.
            </p>
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="vantage-btn-ghost mt-auto px-5 py-3 text-center text-[14px]"
            >
              Join the Discord →
            </a>
          </div>
        </div>

        {/* What happens next — mirrors the unlicensed email copy */}
        <div className="mt-14">
          <div className="vantage-kicker mb-4">What happens next</div>
          <div className="grid gap-4 md:grid-cols-3">
            {NEXT_STEPS.map((s) => (
              <div key={s.n} className="vantage-card flex flex-col gap-2.5 p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-vantage-gold/50 font-display text-[18px] text-vantage-gold">
                  {s.n}
                </div>
                <div className="font-display text-[20px] leading-tight text-vantage-ivory">{s.t}</div>
                <div className="text-[13.5px] leading-relaxed text-vantage-dim">{s.d}</div>
              </div>
            ))}
          </div>

          <div className="vantage-card mt-4 p-6 md:p-7">
            <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-vantage-muted">
              Licensing checklist
            </div>
            <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {LICENSING_CHECKLIST.map((c) => (
                <div key={c} className="flex items-start gap-3 text-[14.5px] text-vantage-fog">
                  <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-[4px] border border-vantage-gold/40" />
                  {c}
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-vantage-faint">
              You don't need to finish licensing before we talk — the call is your main next
              appointment. Getting a head start just means you move faster once you're in.
            </p>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

const NEXT_STEPS = [
  {
    n: "1",
    t: "Lock in your call",
    d: "Confirm your Monday overview seat — or your 1:1 call — using the button above.",
  },
  {
    n: "2",
    t: "Get a head start",
    d: `Start the Xcel pre-licensing course with partner code ${XCEL_PARTNER_CODE} and join the Discord.`,
  },
  {
    n: "3",
    t: "Attend & join",
    d: "Attend the call. If it's a fit, you'll get a short form to officially join the team.",
  },
];

const LICENSING_CHECKLIST = [
  "Attend the Monday overview (or your 1:1 call)",
  "Join the Vantage Discord",
  `Life Insurance Pre Licensing — Xcel course, partner code ${XCEL_PARTNER_CODE}`,
  "Complete the required education",
  "Schedule and pass the state exam",
  "State Requirements — check the steps for your state",
  "Apply for License — apply on nipr.com",
  "Complete Vantage onboarding",
];
