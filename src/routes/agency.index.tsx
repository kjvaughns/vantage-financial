import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicShell } from "@/components/vantage/brand";

export const Route = createFileRoute("/agency/")({
  head: () => ({
    meta: [
      { title: "Build or Power Your Agency — Vantage Financial" },
      {
        name: "description",
        content:
          "Build under Vantage with leads, training, and leadership, or power your established agency with InsuraCloud infrastructure and carrier contracts.",
      },
      { property: "og:title", content: "Build or bring your agency to Vantage" },
      {
        property: "og:description",
        content: "Two paths for insurance leaders: build under Vantage or power your independent agency with InsuraCloud.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgencyPage,
});

export const TRACKS = [
  {
    id: "builder",
    name: "Builder",
    tag: "Build under Vantage",
    fit: "For leaders who already have downlines and want to grow that team under Vantage with stronger systems, leads, training, and leadership.",
    gets: [
      "Lead costs covered for you and your agents",
      "AI dialer for your entire team",
      "FEX, Veteran, and Mortgage Protection leads",
      "Agent training, Vantage culture, and hands-on leadership",
    ],
  },
  {
    id: "owner",
    name: "Owner",
    tag: "Power your own agency",
    fit: "For established agencies keeping their own brand, recruiting, training, and sales operation while upgrading their infrastructure and backend.",
    gets: [
      "Your own agency branding and operating system",
      "One-link contracting and 20+ carrier contracts",
      "Finance, leaderboards, and multi-carrier book tracking",
      "Infrastructure to grow into an IMO with multiple agencies",
    ],
  },
] as const;

const benefits = [
  { t: "One-link contracting", d: "Bring agents into one streamlined contracting flow across 20+ carriers." },
  { t: "Agency branding", d: "Run a professional, branded operation that remains yours." },
  { t: "Book of business", d: "Track production and business across multiple carriers in one place." },
  { t: "Finance management", d: "See the numbers behind your agency and manage growth with clarity." },
  { t: "Leaderboards", d: "Keep production visible and create accountability across your organization." },
  { t: "Built to scale", d: "Grow from an agency into an IMO with multiple agencies underneath you." },
];

const faqs = [
  { q: "Which path is right for me?", a: "Choose Builder only if you already have downlines and want to grow that team under Vantage with our leads, training, culture, and leadership. Choose Owner if you already operate your own branded agency and want stronger infrastructure, contracts, and backend support." },
  { q: "Do I keep my agency brand?", a: "Yes on the Owner path. InsuraCloud gives established owners the infrastructure to operate and scale under their own agency brand." },
  { q: "What does Vantage cover for Builders?", a: "Vantage covers lead costs for you and your agents, provides an AI dialer, supplies FEX, Veteran, and Mortgage Protection leads, and trains your team inside our culture and systems." },
  { q: "What are the contract levels?", a: "Contract levels depend on production, team size, and experience. We review them 1-on-1." },
  { q: "Is income guaranteed?", a: "No. This is a performance-based opportunity. Results depend on your production and your team's." },
];

function AgencyPage() {
  const [team, setTeam] = useState(5);
  const [premium, setPremium] = useState(5000);
  const [override, setOverride] = useState(20);
  const [openFaq, setOpenFaq] = useState(0);
  const est = Math.round(team * premium * (override / 100) * 12);

  return (
    <PublicShell>
      <div className="mx-auto max-w-[920px] px-6 pt-[60px] pb-10 text-center md:px-8">
        <div className="vantage-eyebrow-pill mx-auto mb-5 w-fit">Powered by InsuraCloud</div>
        <h1 className="font-display text-[clamp(44px,7vw,90px)] leading-[0.92] text-vantage-ivory">
          Build or bring your <span className="vantage-gold-text">agency</span> to Vantage
        </h1>
        <p className="mx-auto mt-6 max-w-[600px] text-[17px] leading-relaxed text-vantage-muted">
          Build a team under Vantage with leads, technology, training, and leadership—or keep your
          own agency brand and use InsuraCloud to power the entire operation.
        </p>
        <Link to="/agency/apply" className="vantage-btn-primary mt-7 inline-flex px-7 py-4 text-[16px]">
          Find Your Agency Path <span>→</span>
        </Link>
      </div>

      <div className="mx-auto max-w-[1240px] px-6 pt-14 md:px-8">
        <div className="mb-3 vantage-kicker">Choose your track</div>
        <div className="grid gap-4 md:grid-cols-2">
          {TRACKS.map((t) => (
            <div key={t.id} className="vantage-card flex flex-col gap-4 p-7">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-vantage-faint">{t.tag}</div>
              <div className="font-display text-[34px] leading-none text-vantage-gold">{t.name}</div>
              <p className="text-[14.5px] leading-relaxed text-vantage-muted">{t.fit}</p>
              <div className="flex flex-col gap-2">
                {t.gets.map((g) => (
                  <div key={g} className="flex items-start gap-3 text-[14.5px] text-vantage-fog">
                    <span className="mt-0.5 text-vantage-gold">✦</span>
                    {g}
                  </div>
                ))}
              </div>
              <Link
                to="/agency/apply"
                search={{ track: t.id }}
                className="vantage-btn-primary mt-auto w-full px-5 py-3 text-[14px]"
              >
                Apply for {t.name} <span>→</span>
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <div className="mb-3 vantage-kicker">What you get</div>
        <h2 className="mb-4 font-display text-[clamp(34px,5vw,58px)] leading-none">Everything an independent agency runs on</h2>
        <p className="mb-10 max-w-[760px] text-[15px] leading-relaxed text-vantage-muted">InsuraCloud powers the infrastructure. Vantage brings the contracts and backend support to help established owners scale.</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.t} className="vantage-card p-6">
              <div className="font-display text-[22px] text-vantage-ivory">{b.t}</div>
              <div className="mt-2 text-[14px] leading-relaxed text-vantage-dim">{b.d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <div className="vantage-card vantage-card-gold grid gap-8 p-8 md:grid-cols-2 md:p-12">
          <div>
            <div className="mb-3 vantage-kicker">Override estimator</div>
            <h2 className="font-display text-[clamp(32px,4.5vw,52px)] leading-none">See what a team could look like</h2>
            <div className="mt-6 flex flex-col gap-5">
              <Slider label="Agents on your team" value={team} min={1} max={100} step={1} onChange={setTeam} fmt={(v) => `${v}`} />
              <Slider label="Avg. monthly premium per agent" value={premium} min={1000} max={30000} step={500} onChange={setPremium} fmt={(v) => `$${v.toLocaleString()}`} />
              <Slider label="Your override %" value={override} min={5} max={50} step={1} onChange={setOverride} fmt={(v) => `${v}%`} />
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-[16px] border border-vantage-gold/30 bg-black/30 p-8 text-center">
            <div className="vantage-kicker justify-center">Estimated annual override</div>
            <div className="mt-3 font-display text-[clamp(44px,6vw,72px)] leading-none text-vantage-gold">
              ${est.toLocaleString()}
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-vantage-faint">
              Estimate only, not a guarantee. Actual results depend on contract levels, carrier,
              placement, persistency, and chargebacks.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[900px] px-6 pt-24 md:px-8">
        <div className="mb-3 vantage-kicker">FAQ</div>
        <div className="flex flex-col gap-3">
          {faqs.map((f, i) => (
            <div key={f.q} className="overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.02]">
              <button
                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left text-vantage-ivory"
              >
                <span className="text-[16px] font-semibold">{f.q}</span>
                <span className="text-[20px] text-vantage-gold">{openFaq === i ? "−" : "+"}</span>
              </button>
              {openFaq === i && <div className="px-5 pb-5 text-[15px] leading-relaxed text-vantage-dim">{f.a}</div>}
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link to="/agency/apply" className="vantage-btn-primary inline-flex px-8 py-5 text-[17px]">
            Book your strategy call <span>→</span>
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex justify-between text-[14px] text-vantage-fog">
        {label} <span className="font-semibold text-vantage-gold">{fmt(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="accent-vantage-gold" />
    </label>
  );
}
