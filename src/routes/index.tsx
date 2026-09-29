import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { PublicShell } from "@/components/vantage/brand";
import { getRecruiterBySlug } from "@/lib/applications.functions";
import { saveReferral } from "@/lib/referral";

const searchSchema = z.object({ ref: z.string().optional() });

export const Route = createFileRoute("/")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Vantage Financial — Build a real career in life insurance" },
      {
        name: "description",
        content:
          "A technology-driven life insurance agency for serious agents: uncapped commission, daily pay opportunities, unlimited lead access, 20+ carriers, and a real path into leadership. See the full opportunity at the weekly Vantage Company Overview. Licensed and unlicensed candidates may apply.",
      },
      { property: "og:title", content: "Vantage Financial" },
      {
        property: "og:description",
        content:
          "Uncapped commission, daily pay opportunities, unlimited leads, and a real path into leadership. Apply and attend the weekly Vantage Company Overview.",
      },
      { property: "og:image", content: "https://vantagefinancial.lovable.app/vantage-og.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/png" },
      { name: "twitter:image", content: "https://vantagefinancial.lovable.app/vantage-og.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const heroStats = [
  "Uncapped commission",
  "Daily pay opportunities",
  "Unlimited lead access",
  "20+ carriers",
  "Inbound & outbound sales",
];

const highlights = [
  {
    t: "Uncapped commission",
    d: "Uncapped commission based on position, experience, production, and promotions.",
  },
  {
    t: "Daily pay opportunities",
    d: "Eligible business may pay quickly depending on the carrier, policy placement, and commission status.",
  },
  {
    t: "Unlimited lead access",
    d: "Access a large internal lead pool, ongoing lead campaigns, and multiple sales opportunities.",
  },
  {
    t: "Inbound & outbound sales",
    d: "Work outbound campaigns through the Vantage dialing system and qualify for inbound Policy Service Request opportunities.",
  },
  {
    t: "In-house promotions",
    d: "Earn advancement through production, consistency, leadership, and accountability.",
  },
  {
    t: "Modern sales technology",
    d: "Use power dialing, electronic applications, CRM tools, follow-up systems, and retention automation.",
  },
];

const whyCols = [
  {
    t: "Production",
    d: "A system built to help serious agents maintain activity, improve skill, and close more business.",
  },
  {
    t: "Technology",
    d: "Modern dialing, CRM, electronic applications, follow-up, and retention tools designed for virtual sales.",
  },
  {
    t: "Leadership",
    d: "In-house promotions, team building opportunities, accountability, and long-term career growth.",
  },
];

const values = ["Skill", "Speed", "Production", "Leadership", "Accountability"];

const overviewCovers = [
  "How the Vantage sales system works",
  "Inbound and outbound lead opportunities",
  "Compensation and promotions",
  "Training and technology",
  "Licensed and unlicensed onboarding",
  "What we expect from agents",
  "The path from producer to leader",
];

const licensedFlow = [
  "Your application enters the Vantage recruiting portal",
  "Your recruiter or manager is notified",
  "You're directed to the licensed scheduling page",
  "The team contacts qualified licensed applicants quickly",
  "You begin evaluation, contracting, and onboarding",
];

const unlicensedFlow = [
  "Receive the immediate steps to begin licensing",
  "You're directed to the unlicensed success page",
  "The Monday company overview scheduler is displayed",
  "Select an available Monday overview",
  "Receive licensing instructions and next steps",
  "Complete the overview before moving deeper into onboarding",
];

const whoFor = [
  "Serious candidates who want a real life insurance career",
  "Coachable people who can follow a system",
  "Competitive and self-motivated individuals",
  "People who take personal responsibility",
  "Agents interested in production and leadership",
  "People willing to maintain consistent sales activity",
];

const testimonials = [
  {
    quote:
      "My first month ever in sales, I wrote nearly $50K in business and deposited more than $20,000. The systems here make that kind of start possible.",
    name: "Marquay",
    role: "Vantage Agent",
    initials: "MA",
  },
  {
    quote:
      "At my previous company, my biggest month ever was $8K. My very first month at Vantage I did over $30K — hands down the best leadership and systems I've ever been around.",
    name: "Danny",
    role: "Vantage Agent",
    initials: "DA",
  },
  {
    quote:
      "Vantage is my first company in insurance. I did over $29K my first month and already have my own team. The best systems in the world.",
    name: "Pranav",
    role: "Vantage Agent",
    initials: "PR",
  },
  {
    quote:
      "My first month ever in insurance, with zero experience, I did $31K in sales — all while working from anywhere. I locked in with an open mind and won.",
    name: "Zay",
    role: "Vantage Agent",
    initials: "ZA",
  },
];

const faqs = [
  {
    q: "Is Vantage inbound or outbound?",
    a: "Vantage offers both inbound and outbound sales opportunities.",
  },
  {
    q: "Do I need a license to apply?",
    a: "No. Licensed and unlicensed candidates may apply. Unlicensed applicants must complete their state licensing requirements before selling insurance.",
  },
  {
    q: "What happens after I apply if I am unlicensed?",
    a: "You'll receive the immediate licensing steps and be directed to schedule the Monday Vantage Company Overview.",
  },
  {
    q: "What happens after I apply if I am licensed?",
    a: "Your recruiter or manager will be notified, and qualified licensed applicants will be contacted quickly.",
  },
  {
    q: "When is the company overview?",
    a: "Every Monday at 7:00 PM Central Time and 8:00 PM Eastern Time.",
  },
  {
    q: "Are leads provided?",
    a: "Agents receive access to Vantage lead systems and multiple lead opportunities. Specific access depends on the program and current company guidelines.",
  },
  {
    q: "How does commission work?",
    a: "Commission is uncapped and increases based on position, experience, performance, and promotions.",
  },
  { q: "Is income guaranteed?", a: "No. This is a performance-based sales opportunity." },
];

function LandingPage() {
  const { ref } = Route.useSearch();
  const resolveRecruiter = useServerFn(getRecruiterBySlug);
  const [openFaq, setOpenFaq] = useState(0);

  // Capture referral attribution for this recruiting session. The visitor stays
  // on the normal landing page; the recruiter is preselected later on /apply.
  useEffect(() => {
    if (!ref) return;
    const landing_url = typeof window !== "undefined" ? window.location.href : "";
    resolveRecruiter({ data: { slug: ref } })
      .then((recruiter) => {
        saveReferral({ slug: ref, recruiter, landing_url, invalid: !recruiter });
      })
      .catch(() => {
        saveReferral({ slug: ref, recruiter: null, landing_url, invalid: true });
      });
  }, [ref, resolveRecruiter]);

  // Carry the ref through to the application so it works even without storage.
  const applySearch = ref ? { ref } : undefined;

  return (
    <PublicShell>
      {/* HERO */}
      <div id="top" className="relative overflow-hidden">
        <div className="mx-auto max-w-[920px] px-6 pt-[60px] pb-14 text-center md:px-8">
          <div className="vantage-reveal flex flex-col items-center">
            <div className="vantage-eyebrow-pill mb-5">
              <span className="vantage-glow-dot h-1.5 w-1.5 rounded-full bg-vantage-gold shadow-[0_0_10px_rgba(201,168,76,0.8)]" />
              Now Hiring Serious Agents
            </div>
            <h1 className="max-w-[16ch] font-display text-[clamp(48px,8vw,100px)] leading-[0.9] text-vantage-ivory text-balance">
              Build a real career in <span className="vantage-gold-text">life insurance</span>
            </h1>

            <div className="mt-9 w-full overflow-hidden rounded-[8px] border border-vantage-gold/30 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
              <iframe
                className="aspect-video w-full"
                src="https://www.youtube-nocookie.com/embed/F6PHSd9JtQs?rel=0"
                title="Vantage Financial opportunity overview"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>

            <p className="mt-9 max-w-[560px] text-[17px] leading-relaxed text-vantage-muted">
              Join a technology-driven life insurance agency built for serious agents who want
              uncapped commission, daily pay opportunities, unlimited lead access, hands-on
              training, and a real path into leadership.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3.5">
              <Link
                to="/apply"
                search={applySearch}
                className="vantage-btn-primary px-7 py-4 text-[16px]"
              >
                Start Your Application <span>→</span>
              </Link>
            </div>
            <p className="mt-4 text-[13.5px] text-vantage-faint">
              Licensed and unlicensed candidates may apply.
            </p>

            {/* Credibility row */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 text-[12.5px] text-vantage-muted">
              {heroStats.map((c, i) => (
                <span key={c} className="flex items-center gap-2.5">
                  {i > 0 && <span className="text-vantage-gold/40">•</span>}
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KEY OPPORTUNITY HIGHLIGHTS */}
      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead kicker="The Opportunity" title="Why serious agents apply" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {highlights.map((o) => (
            <div
              key={o.t}
              className="vantage-card flex flex-col gap-2.5 p-6 transition hover:-translate-y-1 hover:border-vantage-gold/50"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-vantage-gold">✦</span>
                <div className="font-display text-[22px] leading-tight text-vantage-ivory">{o.t}</div>
              </div>
              <div className="text-[14px] leading-relaxed text-vantage-dim">{o.d}</div>
            </div>
          ))}
        </div>
        <p className="mt-5 max-w-[820px] text-[12.5px] leading-relaxed text-vantage-faint">
          Income is not guaranteed. Results vary based on licensing, effort, activity, skill, policy
          placement, carrier approvals, chargebacks, and consistency.
        </p>
      </div>

      {/* WHAT IS Vantage */}
      <div id="about" className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead
          kicker="Who We Are"
          title="What is Vantage Financial?"
          body="Vantage Financial is a life insurance agency and brokerage built for serious agents who want to produce at a high level and grow into leadership. We provide access to multiple insurance carriers, lead opportunities, modern sales technology, hands-on training, and a structured path for personal production and team building."
        />
        <div className="vantage-card vantage-card-gold p-7 md:p-8">
          <p className="text-[16px] leading-relaxed text-vantage-fog">
            The full company structure, sales system, compensation path, training process, and
            career opportunity are explained during the weekly{" "}
            <a href="#overview" className="font-semibold text-vantage-gold hover:underline">
              Vantage Company Overview
            </a>
            .
          </p>
        </div>
      </div>

      {/* WHY SERIOUS AGENTS CHOOSE Vantage */}
      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead kicker="Built for Producers" title="Why serious agents choose Vantage" />
        <div className="grid gap-4 md:grid-cols-3">
          {whyCols.map((c) => (
            <div key={c.t} className="vantage-card flex flex-col gap-3 p-7">
              <div className="font-display text-[28px] leading-none text-vantage-gold">{c.t}</div>
              <div className="text-[14.5px] leading-relaxed text-vantage-dim">{c.d}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-vantage-faint">
            Built on
          </span>
          {values.map((v) => (
            <span key={v} className="vantage-eyebrow-pill text-[12px]">
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* LICENSED & UNLICENSED PATHS */}
      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead kicker="Two Ways In" title="Licensed or unlicensed, there's a path forward" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="vantage-card flex flex-col gap-4 p-8">
            <div className="font-display text-[26px] leading-none text-vantage-gold">
              Already licensed?
            </div>
            <p className="text-[15px] leading-relaxed text-vantage-muted">
              Licensed applicants are reviewed quickly and contacted directly by their recruiter or
              manager.
            </p>
            <div className="flex flex-col gap-2.5">
              {licensedFlow.map((s) => (
                <div key={s} className="flex items-start gap-3 text-[15px] text-vantage-fog">
                  <span className="mt-0.5 text-vantage-gold">✦</span>
                  {s}
                </div>
              ))}
            </div>
            <p className="mt-1 text-[12.5px] text-vantage-faint">
              Licensed applicants don't wait for the Monday overview unless their recruiter or
              manager decides it's appropriate.
            </p>
          </div>
          <div className="vantage-card flex flex-col gap-4 p-8">
            <div className="font-display text-[26px] leading-none text-vantage-ivory">
              Not licensed yet?
            </div>
            <p className="text-[15px] leading-relaxed text-vantage-muted">
              You don't need an active life insurance license to apply. Unlicensed applicants attend
              the weekly Vantage Company Overview to understand the opportunity before beginning the
              licensing process.
            </p>
            <div className="flex flex-col gap-2.5">
              {unlicensedFlow.map((s) => (
                <div key={s} className="flex items-start gap-3 text-[15px] text-vantage-fog">
                  <span className="mt-0.5 text-vantage-gold">✦</span>
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* COMPANY OVERVIEW CTA */}
      <div id="overview" className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <div className="vantage-card vantage-card-gold grid gap-8 p-10 md:grid-cols-2 md:p-14">
          <div>
            <div className="mb-3 vantage-kicker">The Full Opportunity</div>
            <h2 className="font-display text-[clamp(36px,5vw,62px)] leading-[0.96]">
              See the full Vantage opportunity
            </h2>
            <p className="mt-5 text-[16.5px] leading-relaxed text-vantage-muted">
              The website gives you the highlights. The Vantage Company Overview explains the
              complete opportunity.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              {overviewCovers.map((c) => (
                <div key={c} className="flex items-start gap-3 text-[15px] text-vantage-fog">
                  <span className="mt-0.5 text-vantage-gold">✦</span>
                  {c}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-center gap-5">
            <div className="rounded-[16px] border border-vantage-gold/30 bg-black/30 p-6 text-center">
              <div className="vantage-kicker mb-2 justify-center">Every Monday</div>
              <div className="font-display text-[clamp(30px,4vw,44px)] leading-none text-vantage-gold">
                7:00 PM CT
              </div>
              <div className="mt-1 font-display text-[clamp(22px,3vw,30px)] leading-none text-vantage-ivory">
                8:00 PM ET
              </div>
            </div>
            <p className="text-center text-[14px] font-semibold leading-relaxed text-vantage-fog">
              This is not just an information call. It is part of our selection process.
            </p>
            <Link
              to="/apply"
              search={applySearch}
              className="vantage-btn-primary w-full px-8 py-5 text-[17px]"
            >
              Start Your Application <span>→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* WHO THIS IS FOR */}
      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead kicker="Selective by Design" title="Who we are looking for" />
        <div className="vantage-card p-8 md:p-10">
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {whoFor.map((w) => (
              <div key={w} className="flex items-start gap-3 text-[15px] text-vantage-fog">
                <span className="mt-0.5 text-vantage-gold">✦</span>
                {w}
              </div>
            ))}
          </div>
          <p className="mt-6 border-t border-white/[0.08] pt-6 text-[14px] leading-relaxed text-vantage-muted">
            Vantage is not designed for people looking for guaranteed income, passive work, or a
            casual way to test the industry.
          </p>
        </div>
      </div>

      {/* TESTIMONIALS */}
      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead kicker="Agent Voices" title="Results from our agents" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {testimonials.map((t) => (
            <div key={t.name} className="vantage-card flex flex-col justify-between gap-6 p-7">
              <p className="text-[15.5px] leading-relaxed text-vantage-fog">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-vantage-gold/15 font-display text-vantage-gold">
                  {t.initials}
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-vantage-ivory">{t.name}</div>
                  <div className="text-[12px] text-vantage-faint">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 max-w-[820px] text-[12.5px] leading-relaxed text-vantage-faint">
          Testimonials reflect individual experiences. Results are not typical or guaranteed.
        </p>
      </div>

      {/* FAQ */}
      <div id="faq" className="mx-auto max-w-[900px] px-6 pt-24 md:px-8">
        <SectionHead kicker="FAQ" title="The straight answers" />
        <div className="flex flex-col gap-3">
          {faqs.map((f, i) => (
            <div
              key={f.q}
              className="overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.02]"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left text-vantage-ivory"
              >
                <span className="text-[16.5px] font-semibold leading-snug">{f.q}</span>
                <span
                  className="flex-none text-[20px] text-vantage-gold transition-transform"
                  style={{ transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)" }}
                >
                  +
                </span>
              </button>
              {openFaq === i && (
                <div className="px-5 pb-5 text-[15px] leading-relaxed text-vantage-dim">{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* APPLY CTA */}
      <div id="apply" className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <div className="vantage-card vantage-card-gold grid gap-8 p-10 md:grid-cols-2 md:p-14">
          <div>
            <h2 className="font-display text-[clamp(40px,5vw,70px)] leading-[0.94]">
              Your empire starts with one application
            </h2>
            <p className="mt-5 text-[16.5px] leading-relaxed text-vantage-muted">
              Complete the short application and tell us why you believe you would be a strong fit
              for Vantage. Licensed applicants are contacted quickly. Unlicensed applicants receive
              the licensing steps and reserve a seat for the next Monday company overview.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <Link
              to="/apply"
              search={applySearch}
              className="vantage-btn-primary w-full px-8 py-5 text-[17px]"
            >
              Start Your Application <span>→</span>
            </Link>
            <p className="text-[13px] text-vantage-faint">
              No résumé required — just a few quick details.
            </p>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

function SectionHead({ kicker, title, body }: { kicker: string; title: string; body?: string }) {
  return (
    <div className="mb-10 max-w-[720px]">
      <div className="mb-3 vantage-kicker">{kicker}</div>
      <h2 className="font-display text-[clamp(34px,5vw,58px)] leading-none">{title}</h2>
      {body && <p className="mt-4 text-[16px] leading-relaxed text-vantage-muted">{body}</p>}
    </div>
  );
}
