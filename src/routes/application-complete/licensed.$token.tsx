import { createFileRoute, Link } from "@tanstack/react-router";
import { VslRequired } from "@/components/vantage/vsl-required";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { PublicShell } from "@/components/vantage/brand";
import { trackApplicationLead } from "@/lib/meta-pixel";
import { CalBookingCard } from "@/components/vantage/cal-booking-card";
import { DISCORD_INVITE_URL } from "@/lib/next-steps";
import {
  getOverviewBooking,
  getSchedulingContext,
  markLicensedFallback,
  markScheduled,
} from "@/lib/applications.functions";

export const Route = createFileRoute("/application-complete/licensed/$token")({
  head: () => ({
    meta: [
      { title: "Application received — Licensed agent interview" },
      { name: "description", content: "Schedule your Vantage Financial licensed agent interview." },
      { property: "og:title", content: "Book your Vantage licensed interview" },
      { property: "og:description", content: "Pick a time that works with your assigned Vantage recruiter." },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => {
    const ctx = await getSchedulingContext({ data: { token: params.token } });
    return { ctx };
  },
  component: LicensedComplete,
});

function LicensedComplete() {
  const { ctx } = Route.useLoaderData();
  const { token } = Route.useParams();
  const mark = useServerFn(markScheduled);
  const markFallback = useServerFn(markLicensedFallback);
  const resolveBooking = useServerFn(getOverviewBooking);
  const [firstName, setFirstName] = useState(ctx.first_name || "there");
  const [booked, setBooked] = useState(false);
  const flagged = useRef(false);

  // Licensed applicants can also grab a 1:1 call with the nearest leader above
  // their recruiter — pre-filled with their name, email, phone and referrer.
  const bookingQuery = useQuery({
    queryKey: ["overview-booking", token],
    queryFn: () => resolveBooking({ data: { token, base_url: "" } }),
    enabled: ctx.found,
    retry: false,
  });

  // Fire the Meta Pixel conversion on success-page load.
  useEffect(() => {
    trackApplicationLead(token, true);
  }, [token]);

  useEffect(() => {
    if (!ctx.first_name) {
      setFirstName(sessionStorage.getItem("vantage_applicant_first") || "there");
    }
  }, [ctx.first_name]);

  useEffect(() => {
    if (ctx.found && ctx.link_missing && !flagged.current) {
      flagged.current = true;
      markFallback({ data: { token } }).catch(() => {});
    }
  }, [ctx.found, ctx.link_missing, markFallback, token]);

  if (!ctx.found) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-[720px] px-6 pt-24 pb-24 text-center md:px-8">
          <h1 className="font-display text-[clamp(36px,6vw,58px)] leading-none">Link expired</h1>
          <p className="mt-4 text-vantage-muted">We couldn't find your application. Please re-apply.</p>
          <div className="mt-6"><Link to="/apply" className="vantage-btn-primary px-6 py-3.5">Start over →</Link></div>
        </div>
      </PublicShell>
    );
  }

  // Stay on this page after booking — they keep their next steps and resources.
  async function onConfirm() {
    try { await mark({ data: { token } }); } catch { /* non-blocking */ }
    setBooked(true);
  }

  const contact = ctx.contact_name;

  return (
    <PublicShell>
      <div className="mx-auto max-w-[900px] px-6 pt-14 pb-24 text-center md:px-8">
        <VslRequired token={token} />
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-vantage-gold text-[26px] text-vantage-card shadow-[0_0_40px_rgba(201,168,76,0.5)]">
          ✓
        </div>
        <div className="vantage-eyebrow-pill mb-4 inline-flex">Licensed agent</div>
        <h1 className="font-display text-[clamp(36px,6vw,58px)] leading-[0.96]">
          Welcome, {firstName} — let's get you interviewed
        </h1>
        <p className="mx-auto mt-4 max-w-[600px] text-[16px] leading-relaxed text-vantage-muted">
          You're already licensed, so we can skip straight to the business conversation with{" "}
          {contact ? <span className="text-vantage-fog">{contact}</span> : "your assigned Vantage recruiter"}
          {" "}— contracting, carriers, lead flow and comp.
        </p>

        <CalBookingCard
          token={token}
          chosenIso={bookingQuery.data?.requested_overview_at ?? null}
          scheduled={String(ctx.scheduling_status ?? "").includes("sched")}
        />

        {/* Licensed-agent resources — prep for the call and the team Discord */}
        <div className="mt-6 grid gap-4 text-left md:grid-cols-2">
          <div className="vantage-card flex flex-col gap-3 p-6">
            <div className="font-display text-[20px] leading-tight text-vantage-ivory">
              Have these ready for the call
            </div>
            <ul className="flex flex-col gap-2.5">
              {CALL_PREP.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[14px] leading-relaxed text-vantage-fog">
                  <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-vantage-gold" />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="vantage-card flex flex-col gap-3 p-6">
            <div className="font-display text-[20px] leading-tight text-vantage-ivory">
              Join the Vantage Discord
            </div>
            <p className="text-[13.5px] leading-relaxed text-vantage-dim">
              Training, carrier updates, announcements, and the producers who'll help you get writing
              business fast.
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

        {/* What happens next — licensed producer track, no pre-licensing */}
        <div className="mt-12 text-left">
          <div className="vantage-kicker mb-4">What happens next</div>
          <div className="grid gap-4 md:grid-cols-3">
            {LICENSED_STEPS.map((s) => (
              <div key={s.n} className="vantage-card flex flex-col gap-2.5 p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-vantage-gold/50 font-display text-[18px] text-vantage-gold">
                  {s.n}
                </div>
                <div className="font-display text-[20px] leading-tight text-vantage-ivory">{s.t}</div>
                <div className="text-[13.5px] leading-relaxed text-vantage-dim">{s.d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <Link to="/" className="vantage-btn-ghost px-6 py-3.5 text-[15px]">Back to Vantage →</Link>
        </div>
      </div>
    </PublicShell>
  );
}

const CALL_PREP = [
  "Your NPN (National Producer Number)",
  "States you're licensed in, plus any lines beyond life",
  "Carriers you're currently appointed with and your release status",
  "Roughly what you're writing now, and what you want to be writing",
  "If you have agents joining you, how many and where they're licensed",
];

const LICENSED_STEPS = [
  {
    n: "1",
    t: "Watch the video, then take the call",
    d: "The video covers the opportunity so we can spend the call on your business, not the basics.",
  },
  {
    n: "2",
    t: "Get contracted",
    d: "We handle carrier contracting and appointments, and set your comp level and override structure.",
  },
  {
    n: "3",
    t: "Onboard and start writing",
    d: "AgentLink contracting, lead flow turned on, and live training with the team — usually within days.",
  },
];
