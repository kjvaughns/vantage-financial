import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { PublicShell } from "@/components/vantage/brand";
import { submitEvaluation, getEvaluationPrefill } from "@/lib/applications.functions";

const searchSchema = z.object({ a: z.string().optional() });

export const Route = createFileRoute("/evaluation")({
  head: () => ({
    meta: [
      { title: "Join the team — Vantage Financial" },
      { name: "description", content: "Finish your Vantage application in a few minutes." },
      { property: "og:title", content: "Vantage evaluation" },
      { property: "og:description", content: "A few quick questions so we can get to know you." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ a: search.a }),
  loader: async ({ deps }) => {
    if (!deps.a) return { prefill: null as null | Awaited<ReturnType<typeof getEvaluationPrefill>> };
    try {
      const prefill = await getEvaluationPrefill({ data: { applicant_id: deps.a } });
      return { prefill };
    } catch {
      return { prefill: null };
    }
  },
  component: EvaluationPage,
});

const TIME_COMMITMENT = ["Part Time", "Full Time", "Full Time Plus"] as const;
const LOOKING_FOR = ["Income", "Career Change", "Sales Experience", "Leadership", "Entrepreneurship", "Flexibility", "Other"] as const;
const PATH_INTEREST = ["Solo Producer", "Top Producer", "Team Builder", "Agency Owner", "Not Sure Yet"] as const;
const COMMISSION_COMFORT = ["Very Comfortable", "Comfortable", "Unsure", "Uncomfortable"] as const;
const YES_NO = ["Yes", "No"] as const;

function EvaluationPage() {
  const { a } = Route.useSearch();
  const { prefill } = Route.useLoaderData();
  const submit = useServerFn(submitEvaluation);

  const pf = prefill && prefill.found ? prefill : null;
  const [firstName, setFirstName] = useState(pf?.first_name ?? "");
  const [lastName, setLastName] = useState(pf?.last_name ?? "");
  const [email, setEmail] = useState(pf?.email ?? "");
  const [phone, setPhone] = useState("");
  const [income, setIncome] = useState("");
  const [employment, setEmployment] = useState("");
  const [timeCommitment, setTimeCommitment] = useState("");
  const [hours, setHours] = useState("");
  const [whyJoin, setWhyJoin] = useState("");
  const [whyYou, setWhyYou] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [pathInterest, setPathInterest] = useState("");
  const [motivation, setMotivation] = useState("");
  const [goal12mo, setGoal12mo] = useState("");
  const [commissionComfort, setCommissionComfort] = useState("");
  const [willingToCall, setWillingToCall] = useState("");
  const [coachable, setCoachable] = useState("");
  const [startTimeframe, setStartTimeframe] = useState("");
  const [comments, setComments] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) return setError("Please add your first and last name.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Please enter a valid email.");
    if (!timeCommitment) return setError("Please choose your time commitment.");
    if (!whyJoin.trim() || whyJoin.trim().length < 10) return setError("Tell us why you want to join (at least a sentence).");
    if (!commissionComfort) return setError("Let us know how comfortable you are with commission-based income.");
    if (!willingToCall) return setError("Let us know if you're willing to make outbound calls daily.");
    if (!coachable) return setError("Let us know if you're coachable.");

    setSubmitting(true);
    try {
      await submit({
        data: {
          applicant_id: a || "",
          email: email.trim(),
          answers: {
            full_name: `${firstName.trim()} ${lastName.trim()}`,
            phone: phone.trim(),
            desired_monthly_income: income.trim(),
            employment_status: employment.trim(),
            time_commitment: timeCommitment,
            hours_per_week: hours.trim(),
            why_join: whyJoin.trim(),
            why_you: whyYou.trim(),
            looking_for: lookingFor,
            path_interest: pathInterest,
            motivation: motivation.trim(),
            goal_12mo: goal12mo.trim(),
            commission_comfort: commissionComfort,
            willing_to_call: willingToCall,
            coachable: coachable,
            start_timeframe: startTimeframe.trim(),
            comments: comments.trim(),
          },
        },
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-[720px] px-6 pt-14 pb-24 md:px-8">
        {done ? (
          <div className="vantage-card vantage-card-gold p-10 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-vantage-gold text-[30px] text-vantage-card">
              ✓
            </div>
            <h1 className="font-display text-[clamp(38px,6vw,58px)] leading-[0.96]">Thanks — we've got your responses.</h1>
            <p className="mx-auto mt-4 max-w-[460px] text-vantage-muted">
              Someone from the Vantage team will review your evaluation and follow up with next steps shortly.
            </p>
            <Link to="/" className="vantage-btn-ghost mt-6 inline-flex px-6 py-3 text-[14px]">Back to home</Link>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="vantage-eyebrow-pill mb-5 inline-flex">Evaluation</div>
              <h1 className="font-display text-[clamp(36px,5.5vw,58px)] leading-[0.96]">Tell us about you</h1>
              <p className="mx-auto mt-4 max-w-[500px] text-[16px] leading-relaxed text-vantage-muted">
                A few questions so we can get to know your goals and how you like to work.
              </p>
            </div>

            <div className="vantage-card mt-10 grid gap-5 p-6 md:p-10">
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 [&>*]:min-w-0">
                <Field label="First name *"><input className="vantage-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Field>
                <Field label="Last name *"><input className="vantage-input" value={lastName} onChange={(e) => setLastName(e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 [&>*]:min-w-0">
                <Field label="Email *"><input type="email" className="vantage-input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                <Field label="Phone"><input type="tel" className="vantage-input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 [&>*]:min-w-0">
                <Field label="Desired monthly income"><input className="vantage-input" placeholder="$" value={income} onChange={(e) => setIncome(e.target.value)} /></Field>
                <Field label="Current employment status"><input className="vantage-input" value={employment} onChange={(e) => setEmployment(e.target.value)} /></Field>
              </div>

              <Field label="Time commitment *">
                <Choice options={TIME_COMMITMENT} value={timeCommitment} onChange={setTimeCommitment} cols={3} />
              </Field>

              <Field label="How many hours per week can you realistically commit?">
                <input type="number" className="vantage-input" value={hours} onChange={(e) => setHours(e.target.value)} />
              </Field>

              <Field label="Why do you want to join Vantage Financial? *">
                <textarea className="vantage-input min-h-[120px] leading-relaxed" rows={4} value={whyJoin} onChange={(e) => setWhyJoin(e.target.value)} />
              </Field>

              <Field label="Why should we choose you?">
                <textarea className="vantage-input min-h-[100px] leading-relaxed" rows={3} value={whyYou} onChange={(e) => setWhyYou(e.target.value)} />
              </Field>

              <Field label="What are you looking for most right now?">
                <Choice options={LOOKING_FOR} value={lookingFor} onChange={setLookingFor} cols={2} />
              </Field>

              <Field label="Which path interests you most?">
                <Choice options={PATH_INTEREST} value={pathInterest} onChange={setPathInterest} cols={2} />
              </Field>

              <Field label="What motivates you most?">
                <input className="vantage-input" value={motivation} onChange={(e) => setMotivation(e.target.value)} />
              </Field>

              <Field label="Your biggest professional goal over the next 12 months?">
                <textarea className="vantage-input min-h-[90px] leading-relaxed" rows={3} value={goal12mo} onChange={(e) => setGoal12mo(e.target.value)} />
              </Field>

              <Field label="How comfortable are you with commission-based income? *">
                <Choice options={COMMISSION_COMFORT} value={commissionComfort} onChange={setCommissionComfort} cols={2} />
              </Field>

              <Field label="Are you willing to make outbound calls and speak with prospects daily? *">
                <Choice options={YES_NO} value={willingToCall} onChange={setWillingToCall} cols={2} />
              </Field>

              <Field label="Are you coachable and willing to follow a proven sales process? *">
                <Choice options={YES_NO} value={coachable} onChange={setCoachable} cols={2} />
              </Field>

              <Field label="How soon could you start?">
                <input className="vantage-input" value={startTimeframe} onChange={(e) => setStartTimeframe(e.target.value)} />
              </Field>

              <Field label="Anything else you'd like us to know? (optional)">
                <textarea className="vantage-input min-h-[80px] leading-relaxed" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
              </Field>

              {error && (
                <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 p-3.5 text-[13.5px] text-red-200">{error}</div>
              )}

              <button onClick={onSubmit} disabled={submitting} className="vantage-btn-primary mt-1 w-full px-6 py-4 text-[16px] disabled:opacity-60">
                {submitting ? "Submitting…" : <>Submit evaluation →</>}
              </button>
            </div>
          </>
        )}
      </div>
    </PublicShell>
  );
}

function Choice({
  options,
  value,
  onChange,
  cols = 2,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  cols?: number;
}) {
  return (
    <div className={`grid gap-2.5 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-[12px] border px-4 py-3 text-left text-[14px] transition ${
            value === opt
              ? "border-vantage-gold bg-vantage-gold/[0.08] text-vantage-ivory"
              : "border-white/10 bg-white/[0.02] text-vantage-fog hover:border-vantage-gold/40"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-vantage-muted">{label}</span>
      {children}
    </div>
  );
}
