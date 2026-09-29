import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/vantage/brand";
import { VslPlayer } from "@/components/vantage/vsl-player";

export const Route = createFileRoute("/watch")({
  validateSearch: (s: Record<string, unknown>) => ({ ref: typeof s.ref === "string" ? s.ref : undefined }),
  head: () => ({
    meta: [
      { title: "Watch before your call — Vantage Financial" },
      { name: "description", content: "Watch the Vantage Financial opportunity video before your 1:1 interview." },
      { property: "og:title", content: "Watch this before our call — Vantage Financial" },
      { property: "og:description", content: "The full Vantage opportunity in one video: the career, the pay, and the path." },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WatchPage,
});

const POINTS = [
  "What Vantage is and how the career works",
  "How you get paid — daily pay and uncapped commission",
  "The path from applicant to licensed, producing agent",
];

function WatchPage() {
  const { ref } = Route.useSearch();
  return (
    <PublicShell>
      <div className="mx-auto max-w-[900px] px-5 pt-12 pb-24 text-center md:px-8">
        <div className="vantage-eyebrow-pill mb-4 inline-flex">Required before your 1:1</div>
        <h1 className="font-display text-[clamp(38px,7vw,72px)] leading-[0.95] text-vantage-ivory">
          Watch this <span className="vantage-gold-text">before our call</span>
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-relaxed text-vantage-muted">
          This covers everything about the opportunity, so our time together is spent on you and your next move.
        </p>
        <VslPlayer className="mt-8" />
        <ul className="mx-auto mt-8 grid max-w-[640px] gap-3 text-left">
          {POINTS.map((p) => (
            <li key={p} className="flex gap-3 text-[15px] text-vantage-ivory">
              <span className="text-vantage-gold">✓</span>
              {p}
            </li>
          ))}
        </ul>
        <Link
          to="/apply"
          search={ref ? ({ ref } as never) : undefined}
          className="mt-10 inline-block rounded-[8px] bg-vantage-gold px-7 py-3.5 text-[15px] font-bold text-vantage-card"
        >
          Apply & book your 1:1 →
        </Link>
      </div>
    </PublicShell>
  );
}
