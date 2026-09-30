import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { formatPhoneInput, isValidUsPhone } from "@/lib/phone";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { PublicShell } from "@/components/vantage/brand";
import { StateCombobox } from "@/components/vantage/state-combobox";
import { RecruiterCombobox, type RecruiterSelection } from "@/components/vantage/recruiter-combobox";
import {
  submitApplication,
  getRecruiterBySlug,
} from "@/lib/applications.functions";
import { getOverviewSlots } from "@/lib/calendly.functions";
import { InterviewSlotPicker } from "@/components/vantage/interview-slot-picker";
import { getReferral } from "@/lib/referral";


const searchSchema = z.object({
  ref: z.string().optional(),
});

export const Route = createFileRoute("/apply")({
  head: () => ({
    meta: [
      { title: "Apply — Vantage Financial" },
      {
        name: "description",
        content: "Apply to join the Vantage Financial recruiting team. Three minutes, no résumé.",
      },
      { property: "og:title", content: "Apply to Vantage Financial" },
      {
        property: "og:description",
        content: "Three minutes. No résumé. A team lead follows up within one business day.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search) => searchSchema.parse(search),
  component: ApplyPage,
});

type Form = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  state: string;
  us_citizen: boolean | null;
  licensed: boolean | null;
  has_downlines: boolean;
  overview_slot: string;
  instagram_handle: string;
  why_text: string;
  consent_contact: boolean;
};

const initial: Form = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  state: "",
  us_citizen: null,
  licensed: null,
  has_downlines: false,
  overview_slot: "",
  instagram_handle: "",
  why_text: "",
  consent_contact: false,
};

function ApplyPage() {
  const { ref } = Route.useSearch();
  const navigate = useNavigate();
  const submit = useServerFn(submitApplication);
  const resolveRecruiter = useServerFn(getRecruiterBySlug);
  const fetchSlots = useServerFn(getOverviewSlots);

  // Live Monday overview availability from Calendly. If this fails or comes back
  // empty the field is simply skipped — applications are never blocked on it.
  const slotsQuery = useQuery({
    queryKey: ["overview-slots"],
    queryFn: () => fetchSlots(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const slots = slotsQuery.data?.slots ?? [];


  const [form, setForm] = useState<Form>(initial);
  // Final selected recruiter (what gets submitted) + the original referral-link
  // recruiter (kept for attribution audit even if the applicant changes it).
  const [recruiter, setRecruiter] = useState<RecruiterSelection | null>(null);
  const [originalReferral, setOriginalReferral] = useState<RecruiterSelection | null>(null);
  const [referralSlug, setReferralSlug] = useState("");
  const [invalidSlug, setInvalidSlug] = useState("");
  const [landingUrl, setLandingUrl] = useState("");

  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Preselect the referring recruiter from the current recruiting session
  // (referral link captured on the landing page), falling back to a ?ref= slug
  // on this page directly. Invalid/inactive slugs are recorded but never block.
  useEffect(() => {
    const stored = getReferral();
    if (stored) {
      setReferralSlug(stored.slug);
      setLandingUrl(stored.landing_url);
      if (stored.recruiter) {
        setRecruiter(stored.recruiter);
        setOriginalReferral(stored.recruiter);
      } else {
        setInvalidSlug(stored.slug);
      }
      return;
    }
    if (ref) {
      setReferralSlug(ref);
      resolveRecruiter({ data: { slug: ref } })
        .then((r) => {
          if (r) {
            setRecruiter(r);
            setOriginalReferral(r);
          } else {
            setInvalidSlug(ref);
          }
        })
        .catch(() => setInvalidSlug(ref));
    }
  }, [ref, resolveRecruiter]);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function onSubmit() {
    const errs: string[] = [];
    if (!form.first_name.trim()) errs.push("first name");
    if (!form.last_name.trim()) errs.push("last name");
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errs.push("a valid email");
    if (!isValidUsPhone(form.phone)) errs.push("phone");
    if (!form.state) errs.push("your state");
    if (form.licensed === null) errs.push("your licensing status");
    if (!slotsQuery.isLoading && slots.length > 0 && !form.overview_slot) errs.push("a time for your 1:1 call");
    if (!recruiter) errs.push("who referred you");

    if (!form.why_text.trim() || form.why_text.trim().length < 10)
      errs.push("a short reason (min 10 chars)");
    if (!form.consent_contact) errs.push("consent to be contacted");
    if (errs.length) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setSubmitting(true);

    const referral_source: "referral_link" | "manual" | "self" = recruiter?.self
      ? "self"
      : originalReferral && recruiter && !recruiter.custom && originalReferral.id === recruiter.id
        ? "referral_link"
        : "manual";

    try {
      const res = await submit({
        data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          state: form.state,
          licensed: form.licensed === true,
          has_downlines: form.licensed === true && form.has_downlines,
          instagram_handle: form.instagram_handle.trim(),
          why_text: form.why_text.trim(),
          consent_contact: true,
          referred_by_profile_id:
            recruiter && !recruiter.custom && !recruiter.self ? recruiter.id : "",
          referred_by_name: recruiter?.custom ? (recruiter.full_name ?? "") : "",
          original_referral_profile_id: recruiter?.self ? "" : (originalReferral?.id ?? ""),
          referral_slug: referralSlug,
          referral_source,
          referral_landing_url: landingUrl,
          invalid_referral_slug: invalidSlug,
          requested_overview_at: form.overview_slot,
        },
      });

      // Meta Pixel conversion fires on the success page (reliable on load,
      // not cut off by this redirect) — see src/lib/meta-pixel.ts.

      sessionStorage.setItem("vantage_applicant_first", form.first_name.trim());
      if (res.booked_at) sessionStorage.setItem(`vantage_booked_${res.token}`, res.booked_at);
      // Route by the applicant's own answer (source of truth on the client),
      // falling back to the server's echo. Prevents any drift between the two.
      const isLicensed =
        form.licensed === true || res.success_page_type === "licensed";
      if (isLicensed) {
        navigate({ to: "/application-complete/licensed/$token", params: { token: res.token } });
      } else {
        navigate({ to: "/application-complete/unlicensed/$token", params: { token: res.token } });
      }
    } catch (e) {
      setErrors([(e as Error).message || "Something went wrong. Try again."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-[900px] px-6 pt-14 pb-24 md:px-8">
        <div className="vantage-reveal text-center">
          <div className="vantage-eyebrow-pill mb-5 inline-flex">Join the team</div>
          <h1 className="font-display text-[clamp(40px,6vw,68px)] leading-none">
            Build your empire in insurance sales
          </h1>
          <p className="mx-auto mt-4 max-w-[540px] text-[16px] leading-relaxed text-vantage-muted">
            Uncapped commissions with daily pay, unlimited leads, and discounted licensing and
            training.
            Three minutes to apply — no résumé required.
          </p>

          {/* Value prop strip — make the "why" obvious above the fold */}
          <div className="mx-auto mt-7 flex max-w-[560px] flex-wrap items-center justify-center gap-2.5">
            {VALUE_PROPS.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[12.5px] font-medium text-vantage-fog"
              >
                <span className="text-vantage-gold">✓</span>
                {v}
              </span>
            ))}
          </div>

          {recruiter && (
            <div className="mx-auto mt-7 inline-flex items-center gap-3 rounded-full border border-vantage-gold/30 bg-vantage-gold/[0.08] py-2 pl-2 pr-5">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-vantage-gold text-[13px] font-bold text-vantage-card">
                {(recruiter.full_name ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="text-[13.5px] text-vantage-dim">
                Referred by{" "}
                <span className="font-semibold text-vantage-ivory">{recruiter.full_name}</span>
              </span>
            </div>
          )}
        </div>

        <div className="vantage-card mt-12 grid grid-cols-[minmax(0,1fr)] gap-4 p-5 sm:p-6 md:p-10 [&>*]:min-w-0">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 [&>*]:min-w-0">
            <Field label="First name *">
              <input
                className="vantage-input"
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
              />
            </Field>
            <Field label="Last name *">
              <input
                className="vantage-input"
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Email *">
            <input
              type="email"
              className="vantage-input"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Phone *">
            <input
              type="tel"
              className="vantage-input"
              value={form.phone}
              onChange={(e) => set("phone", formatPhoneInput(e.target.value))}
            />
            {form.phone && !isValidUsPhone(form.phone) && (
              <p className="mt-1.5 text-[12px] text-destructive">Enter a valid 10-digit US mobile number.</p>
            )}
          </Field>
          <Field label="State *">
            <StateCombobox value={form.state} onChange={(v) => set("state", v)} />
          </Field>
          <Field label="Are you currently licensed? *">
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: true, label: "Yes, I'm licensed" },
                  { value: false, label: "No, not yet" },
                ] as const
              ).map((opt) => {
                const active = form.licensed === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      set("licensed", opt.value);
                      if (opt.value === false) set("has_downlines", false);
                    }}
                    className={cn(
                      "vantage-input flex min-h-[54px] cursor-pointer touch-manipulation items-center justify-center gap-2 text-center font-semibold transition-colors select-none",
                      active
                        ? "border-vantage-gold bg-vantage-gold text-vantage-card shadow-[0_0_24px_rgba(201,168,76,0.25)]"
                        : "text-vantage-muted hover:border-vantage-gold/50 hover:text-vantage-ivory active:border-vantage-gold",
                    )}
                  >
                    {active && <span aria-hidden>✓</span>}
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Licensed producers bringing a team get a different conversation. */}
            {form.licensed === true && (
              <button
                type="button"
                role="checkbox"
                aria-checked={form.has_downlines}
                onClick={() => set("has_downlines", !form.has_downlines)}
                className={cn(
                  "mt-3 flex w-full cursor-pointer items-start gap-3 rounded-[12px] border px-4 py-3.5 text-left transition-colors",
                  form.has_downlines
                    ? "border-vantage-gold bg-vantage-gold/[0.1]"
                    : "border-white/10 bg-white/[0.03] hover:border-vantage-gold/50",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-[5px] border text-[12px] font-bold transition-colors",
                    form.has_downlines
                      ? "border-vantage-gold bg-vantage-gold text-vantage-card"
                      : "border-vantage-gold/40 text-transparent",
                  )}
                >
                  ✓
                </span>
                <span>
                  <span className="block text-[14px] font-semibold text-vantage-ivory">
                    I have downlines coming with me
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-vantage-muted">
                    Check this if you have agents on your team joining Vantage with you — we'll cover
                    team contracting and your override structure on the call.
                  </span>
                </span>
              </button>
            )}
          </Field>

          {!slotsQuery.isLoading && slots.length > 0 && (
            <Field label="Book your 1:1 interview call *">
              <InterviewSlotPicker
                slots={slots}
                value={form.overview_slot}
                onChange={(iso) => set("overview_slot", iso)}
              />
              <p className="mt-2 text-[12.5px] leading-relaxed text-vantage-muted">
                Live availability, shown in your time zone. Your call is booked automatically when
                you submit — the calendar invite lands in your email.
              </p>
            </Field>
          )}




          <Field label="Who referred you? *">
            <RecruiterCombobox
              value={recruiter}
              onChange={setRecruiter}
              invalid={errors.includes("who referred you")}
            />
            <p className="mt-2 text-[12.5px] text-vantage-muted">
              Only pick an agent if they personally referred you. If you messaged us or found
              Vantage on your own, choose <span className="text-vantage-gold">"I found Vantage on my
              own"</span> — our team will reach out.
            </p>
            {invalidSlug && !recruiter && (
              <p className="mt-2 text-[12.5px] text-vantage-muted">
                We couldn't match that referral link — search below, or type your recruiter's name
                and choose "Add" if they aren't listed yet.
              </p>
            )}
          </Field>
          <Field label="Instagram handle">
            <input
              className="vantage-input"
              placeholder="@yourhandle (optional)"
              value={form.instagram_handle}
              onChange={(e) => set("instagram_handle", e.target.value)}
            />
          </Field>
          <Field label="Why do you want to work with Vantage? *">
            <textarea
              className="vantage-input"
              rows={4}
              value={form.why_text}
              onChange={(e) => set("why_text", e.target.value)}
            />
          </Field>
          <label className="flex items-start gap-3 text-[14px] leading-relaxed text-vantage-fog">
            <input
              type="checkbox"
              checked={form.consent_contact}
              onChange={(e) => set("consent_contact", e.target.checked)}
              className="mt-1 h-4 w-4 accent-vantage-gold"
            />
            I agree to be contacted by Vantage Financial about agent opportunities and confirm my
            information is accurate. *
          </label>

          {errors.length > 0 && (
            <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 p-3.5 text-[13.5px] text-red-200">
              Please add {errors.join(", ")}.
            </div>
          )}

          <button
            onClick={onSubmit}
            disabled={submitting}
            className="vantage-btn-primary mt-2 w-full px-6 py-4 text-[16px] disabled:opacity-60"
          >
            {submitting ? (
              "Submitting…"
            ) : (
              <>
                Submit Application <span>→</span>
              </>
            )}
          </button>
          <p className="text-center text-[12px] text-vantage-faint">
            By applying you agree to be contacted about agent opportunities. No spam.
          </p>

          <div className="mt-2 text-center text-[13px] text-vantage-faint">
            Already an agent?{" "}
            <Link to="/login" className="text-vantage-gold hover:underline">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

const VALUE_PROPS = ["Daily pay", "Unlimited leads", "Discounted licensing & training"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-vantage-muted">
        {label}
      </span>
      {children}
    </div>
  );
}
