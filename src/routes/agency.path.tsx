import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PublicShell } from "@/components/vantage/brand";
import { PATH_QUESTIONS, recommendAgencyPath, type PathResult } from "@/lib/agency-path.functions";

export const Route = createFileRoute("/agency/path")({
  head: () => ({
    meta: [
      { title: "Find Your Agency Path — Vantage Financial" },
      { name: "description", content: "Answer six quick questions and get a personalized recommendation: individual agent, Builder, or Owner." },
      { property: "og:title", content: "Find Your Agency Path — Vantage Financial" },
      { property: "og:description", content: "A quick AI-guided questionnaire that matches you with the right Vantage path." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PathFinder,
});

const NAMES = { agent: "Individual Agent", builder: "Builder", owner: "Owner" };

function PathFinder() {
  const recommend = useServerFn(recommendAgencyPath);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [result, setResult] = useState<PathResult | null>(null);
  const [busy, setBusy] = useState(false);
  const q = PATH_QUESTIONS[step];

  async function advance(next: Record<string, string>) {
    if (step < PATH_QUESTIONS.length - 1) {
      const nextQ = PATH_QUESTIONS[step + 1];
      setMultiSel(nextQ.multi ? (next[nextQ.id]?.split("; ") ?? []) : []);
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      const r = await recommend({ data: { answers: next } });
      setResult(r);
      sessionStorage.setItem("vantage_agency_path", JSON.stringify({ answers: next, result: r }));
    } finally {
      setBusy(false);
    }
  }

  async function pick(opt: string) {
    await advance({ ...answers, [q.id]: opt });
  }

  function toggleMulti(opt: string) {
    setMultiSel((s) => (s.includes(opt) ? s.filter((o) => o !== opt) : [...s, opt]));
  }

  async function commitMulti() {
    if (multiSel.length === 0) return;
    await advance({ ...answers, [q.id]: multiSel.join("; ") });
  }

  function goBack() {
    const prev = step - 1;
    const prevQ = PATH_QUESTIONS[prev];
    setMultiSel(prevQ.multi ? (answers[prevQ.id]?.split("; ") ?? []) : []);
    setStep(prev);
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-[720px] px-6 py-14 md:px-8">
        <div className="vantage-kicker mb-3">Powered by InsuraCloud</div>
        <h1 className="font-display text-[clamp(40px,6vw,72px)] leading-[0.95]">Find your agency path</h1>

        {!result && !busy && (
          <div className="mt-10">
            <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-vantage-gold transition-all" style={{ width: `${(step / PATH_QUESTIONS.length) * 100}%` }} />
            </div>
            <div className="text-[13px] text-vantage-faint">Question {step + 1} of {PATH_QUESTIONS.length}</div>
            <h2 className="mt-2 font-display text-[32px] leading-none">{q.q}</h2>
            <div className="mt-6 grid gap-3">
              {q.options.map((o) => (
                <button key={o} type="button" onClick={() => pick(o)}
                  className={cn("vantage-card p-4 text-left text-[15px] transition-all hover:border-vantage-gold/60",
                    answers[q.id] === o && "border-vantage-gold bg-vantage-gold/10 text-vantage-gold")}>
                  {o}
                </button>
              ))}
            </div>
            {step > 0 && <button className="mt-5 text-[13px] text-vantage-muted" onClick={() => setStep(step - 1)}>← Back</button>}
          </div>
        )}

        {busy && <div className="mt-16 text-center text-vantage-muted">Analyzing your answers…</div>}

        {result && (
          <div className="vantage-card vantage-card-gold mt-10 p-8">
            <div className="vantage-kicker">Recommended: {NAMES[result.recommendation]}</div>
            <h2 className="mt-2 font-display text-[40px] leading-none text-vantage-gold">{result.headline}</h2>
            <ul className="mt-5 space-y-2">
              {result.reasons.map((r) => <li key={r} className="flex gap-3 text-[15px] text-vantage-fog"><span className="text-vantage-gold">✦</span>{r}</li>)}
            </ul>
            {result.pain_points.length > 0 && (
              <p className="mt-5 text-[13.5px] text-vantage-muted">What we'll focus on: {result.pain_points.join(" · ")}</p>
            )}
            {result.recommendation === "agent" ? (
              <Link to="/apply" className="vantage-btn-primary mt-7 w-full px-6 py-4">Apply as an Agent →</Link>
            ) : (
              <Link to="/agency/apply" search={{ track: result.recommendation, prefill: true }} className="vantage-btn-primary mt-7 w-full px-6 py-4">
                Continue my {NAMES[result.recommendation]} application →
              </Link>
            )}
            <button className="mt-4 w-full text-[13px] text-vantage-muted" onClick={() => { setResult(null); setStep(0); setAnswers({}); }}>Retake</button>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
