import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { PublicShell } from "@/components/vantage/brand";
import { StateCombobox } from "@/components/vantage/state-combobox";
import { InterviewSlotPicker } from "@/components/vantage/interview-slot-picker";
import { submitApplication } from "@/lib/applications.functions";
import { getOverviewSlots } from "@/lib/calendly.functions";
import { getReferral } from "@/lib/referral";
import { formatPhoneInput, isValidUsPhone } from "@/lib/phone";
import { TRACKS } from "./agency.index";

const searchSchema = z.object({ track: z.enum(["builder", "owner"]).optional(), prefill: z.boolean().optional() });

export const Route = createFileRoute("/agency/apply")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Agency Owner Application — Vantage Financial" },
      { name: "description", content: "Apply to build under Vantage or power your established agency with InsuraCloud, then book your strategy call." },
      { property: "og:title", content: "Apply as an Agency Owner — Vantage Financial" },
      { property: "og:description", content: "Pick your track and book a 1-on-1 agency strategy call." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgencyApply,
});

type Track = "builder" | "owner";
const PRODUCTION = ["Under $10K", "$10K–$25K", "$25K–$50K", "$50K–$100K", "$100K+"];
const BUILDER_PRIORITIES = ["leads", "systems", "training", "leadership", "compensation", "other"] as const;
const PRIORITY_LABELS: Record<(typeof BUILDER_PRIORITIES)[number], string> = {
  leads: "Leads", systems: "Systems", training: "Training", leadership: "Leadership",
  compensation: "Compensation", other: "Something else",
};

function AgencyApply() {
  const { track: initialTrack, prefill } = Route.useSearch();
  const navigate = useNavigate();
  const submit = useServerFn(submitApplication);
  const fetchSlots = useServerFn(getOverviewSlots);
  const slotsQuery = useQuery({ queryKey: ["overview-slots"], queryFn: () => fetchSlots(), retry: false, staleTime: 300000 });
  const slots = slotsQuery.data?.slots ?? [];

  const [track, setTrack] = useState<Track | null>(initialTrack ?? null);
  const [f, setF] = useState({
    first_name: "", last_name: "", email: "", phone: "", state: "",
    us_citizen: null as boolean | null, licensed: null as boolean | null,
    team_size: "", production: "", builder_priorities: [] as string[], builder_other: "",
    agency_name: "", bottleneck: "", help_needed: "", slot: "", consent: false,
  });
  const [ref, setRef] = useState<ReturnType<typeof getReferral>>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [quiz, setQuiz] = useState<{ answers: Record<string, string>; result: { recommendation: string; headline: string; pain_points: string[] } } | null>(null);
  useEffect(() => setRef(getReferral()), []);
  useEffect(() => {
    if (!prefill) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem("vantage_agency_path") ?? "null");
      if (!saved) return;
      setQuiz(saved);
      const a = saved.answers as Record<string, string>;
      const teamMap: Record<string, string> = { "1–3": "2", "4–10": "6", "11–25": "15", "25+": "30" };
      const painMap: Record<string, string> = { "Lead cost and consistency": "leads", "Training and retaining agents": "training", "Tech, dialer, and systems": "systems", "Leadership and mentorship": "leadership" };
      setF((p) => ({
        ...p,
        team_size: teamMap[a.team] ?? p.team_size,
        production: PRODUCTION.includes(a.production) ? a.production : p.production,
        builder_priorities: painMap[a.pain] ? [painMap[a.pain]] : p.builder_priorities,
        bottleneck: a.pain ?? p.bottleneck,
        licensed: a.role?.startsWith("New") ? false : true,
      }));
    } catch { /* ignore */ }
  }, [prefill]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function onSubmit() {
    const e: string[] = [];
    if (!track) e.push("a track");
    if (!f.first_name.trim()) e.push("first name");
    if (!f.last_name.trim()) e.push("last name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.push("a valid email");
    if (!isValidUsPhone(f.phone)) e.push("phone");
    if (!f.state) e.push("your state");
    if (f.us_citizen === null) e.push("citizenship status");
    if (f.licensed === null) e.push("licensing status");
    if (track === "builder") {
      if (f.team_size === "" || Number(f.team_size) < 1) e.push("at least one current downline");
      if (!f.production) e.push("monthly team production");
      if (f.builder_priorities.length === 0) e.push("at least one priority");
      if (f.builder_priorities.includes("other") && !f.builder_other.trim()) e.push("what else you are looking for");
    }
    if (track === "owner") {
      if (!f.agency_name.trim()) e.push("agency name");
      if (f.team_size === "" || Number(f.team_size) < 1) e.push("at least one active writer");
      if (!f.bottleneck.trim()) e.push("current bottleneck");
      if (!f.help_needed.trim()) e.push("what you need help with");
    }
    if (slots.length > 0 && !f.slot) e.push("a strategy call time");
    if (!f.consent) e.push("consent to be contacted");
    if (f.us_citizen === false) return setErrors(["this opportunity requires US citizenship or work authorization"]);
    if (e.length) return setErrors(e);
    setErrors([]);
    setBusy(true);
    const selectedTrack = TRACKS.find((t) => t.id === track);
    if (!selectedTrack) return setErrors(["a valid agency path"]);
    const label = selectedTrack.name;
    try {
      const res = await submit({
        data: {
          first_name: f.first_name.trim(), last_name: f.last_name.trim(), email: f.email.trim(),
          phone: f.phone.trim(), state: f.state, licensed: f.licensed === true,
          has_downlines: Number(f.team_size) > 0,
          why_text: (track === "builder"
            ? `[Agency – ${label}] Looking for: ${f.builder_priorities.map((p) => PRIORITY_LABELS[p as keyof typeof PRIORITY_LABELS] ?? p).join(", ")}${f.builder_other.trim() ? ` — ${f.builder_other.trim()}` : ""}`
            : `[Agency – ${label}] ${f.help_needed.trim()}`)
            + (quiz ? `\n\n[Path Finder → ${quiz.result.recommendation}] ${quiz.result.headline}. Pain points: ${quiz.result.pain_points.join("; ")}. Answers: ${Object.values(quiz.answers).join(" | ")}` : ""),
          consent_contact: true,
          referred_by_profile_id: ref?.recruiter?.id ?? "",
          referred_by_name: ref?.recruiter ? "" : "Agency Owners page",
          original_referral_profile_id: ref?.recruiter?.id ?? "",
          referral_slug: ref?.slug ?? "",
          referral_source: ref?.recruiter ? "referral_link" : "manual",
          referral_landing_url: ref?.landing_url ?? "",
          invalid_referral_slug: "",
          requested_overview_at: f.slot,
          agency: {
            track,
            team_size: Number(f.team_size),
            monthly_production: track === "builder" ? f.production : "",
            agency_name: track === "owner" ? f.agency_name.trim() : "",
            builder_priorities: track === "builder" ? f.builder_priorities : [],
            builder_priority_other: track === "builder" ? f.builder_other.trim() : "",
            bottleneck: track === "owner" ? f.bottleneck.trim() : "",
            help_needed: track === "owner" ? f.help_needed.trim() : "",
          },
        },
      });
      sessionStorage.setItem("vantage_applicant_first", f.first_name.trim());
      if (res.booked_at) sessionStorage.setItem(`vantage_booked_${res.token}`, res.booked_at);
      navigate({
        to: f.licensed ? "/application-complete/licensed/$token" : "/application-complete/unlicensed/$token",
        params: { token: res.token },
      });
    } catch (err) {
      setErrors([(err as Error).message || "Something went wrong. Try again."]);
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-[10px] border border-white/10 bg-white/[0.03] px-4 py-3 text-[15px] text-vantage-ivory outline-none focus:border-vantage-gold/60";
  const chooseTrack = (next: Track) => {
    setTrack(next);
    setF((prev) => ({
      ...prev,
      team_size: "", production: "", builder_priorities: [], builder_other: "",
      agency_name: "", bottleneck: "", help_needed: "",
    }));
  };
  const togglePriority = (priority: string) => setF((prev) => ({
    ...prev,
    builder_priorities: prev.builder_priorities.includes(priority)
      ? prev.builder_priorities.filter((item) => item !== priority)
      : [...prev.builder_priorities, priority],
    builder_other: priority === "other" && prev.builder_priorities.includes("other") ? "" : prev.builder_other,
  }));
  const Toggle = ({ v, onChange }: { v: boolean | null; onChange: (b: boolean) => void }) => (
    <div className="flex gap-2">
      {[true, false].map((b) => (
        <button key={String(b)} type="button" onClick={() => onChange(b)}
          className={cn("flex-1 rounded-[10px] border px-4 py-3 text-[14px] font-semibold",
            v === b ? "border-vantage-gold bg-vantage-gold/15 text-vantage-gold" : "border-white/10 text-vantage-dim")}>
          {b ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );

  return (
    <PublicShell>
      <div className="mx-auto max-w-[760px] px-6 py-14 md:px-8">
        <div className="vantage-kicker mb-3">Powered by InsuraCloud</div>
        <h1 className="font-display text-[clamp(40px,6vw,72px)] leading-[0.95]">Apply & book your strategy call</h1>

        {quiz ? (
          <p className="mt-4 rounded-[10px] border border-vantage-gold/30 bg-vantage-gold/10 px-4 py-3 text-[13.5px] text-vantage-fog">Pre-filled from your Path Finder answers. Review and adjust anything below.</p>
        ) : (
          <Link to="/agency/path" className="mt-4 inline-block text-[13.5px] text-vantage-gold underline-offset-4 hover:underline">Not sure which path? Take the 1-minute Path Finder →</Link>
        )}
        <Section n="1" title="Pick your track">
          <div className="grid gap-3 sm:grid-cols-2">
            {TRACKS.map((t) => (
              <button key={t.id} type="button" onClick={() => chooseTrack(t.id)}
                className={cn("vantage-card relative p-4 text-left transition-all duration-200 hover:border-vantage-gold/50",
                  track === t.id && "scale-[1.02] !border-vantage-gold !bg-vantage-gold/15 !shadow-[0_0_32px_rgba(201,168,76,0.35)] ring-2 ring-vantage-gold")}>
                {track === t.id && <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-vantage-gold text-[13px] font-bold text-vantage-black">✓</span>}
                <div className="font-display text-[24px] text-vantage-gold">{t.name}</div>
                <div className="text-[12.5px] text-vantage-dim">{t.tag}</div>
              </button>
            ))}
          </div>
        </Section>

        <Section n="2" title="About you & your agency">
          <div className="grid gap-4 sm:grid-cols-2">
            <input className={input} placeholder="First name *" value={f.first_name} onChange={(e) => set("first_name", e.target.value)} />
            <input className={input} placeholder="Last name *" value={f.last_name} onChange={(e) => set("last_name", e.target.value)} />
            <input className={input} placeholder="Email *" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
            <div>
              <input className={input} placeholder="Phone *" value={f.phone} onChange={(e) => set("phone", formatPhoneInput(e.target.value))} />
              {f.phone && !isValidUsPhone(f.phone) && <p className="mt-1 text-[12px] text-destructive">Enter a valid 10-digit US number.</p>}
            </div>
          </div>
          <div className="mt-4"><StateCombobox value={f.state} onChange={(v) => set("state", v)} /></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><Label>US citizen or authorized to work? *</Label><Toggle v={f.us_citizen} onChange={(b) => set("us_citizen", b)} /></div>
            <div><Label>Currently licensed? *</Label><Toggle v={f.licensed} onChange={(b) => set("licensed", b)} /></div>
          </div>
          {f.us_citizen === false && <p className="mt-2 text-[13px] text-destructive">This opportunity requires US citizenship or work authorization.</p>}
          {track === "builder" && (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <input className={input} type="number" min={1} placeholder="Current downlines *" value={f.team_size} onChange={(e) => set("team_size", e.target.value)} />
                <ProductionSelect value={f.production} onChange={(v) => set("production", v)} />
              </div>
              <div>
                <Label>What matters most to you? Select all that apply. *</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {BUILDER_PRIORITIES.map((priority) => (
                    <label key={priority} className={cn("flex cursor-pointer items-center gap-2 rounded-[8px] border px-3 py-3 text-[14px]", f.builder_priorities.includes(priority) ? "border-vantage-gold bg-vantage-gold/10 text-vantage-gold" : "border-white/10 text-vantage-fog")}>
                      <GoldCheck checked={f.builder_priorities.includes(priority)} onChange={() => togglePriority(priority)} />
                      {PRIORITY_LABELS[priority]}
                    </label>
                  ))}
                </div>
              </div>
              {f.builder_priorities.includes("other") && <input className={input} maxLength={300} placeholder="What else are you looking for? *" value={f.builder_other} onChange={(e) => set("builder_other", e.target.value)} />}
            </div>
          )}
          {track === "owner" && (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <input className={input} maxLength={160} placeholder="Agency name *" value={f.agency_name} onChange={(e) => set("agency_name", e.target.value)} />
                <input className={input} type="number" min={1} placeholder="Active writers *" value={f.team_size} onChange={(e) => set("team_size", e.target.value)} />
              </div>
              <textarea className={cn(input, "min-h-[100px]")} maxLength={1000} placeholder="What is your agency's biggest bottleneck right now? *" value={f.bottleneck} onChange={(e) => set("bottleneck", e.target.value)} />
              <textarea className={cn(input, "min-h-[100px]")} maxLength={1000} placeholder="What do you need the most help with? *" value={f.help_needed} onChange={(e) => set("help_needed", e.target.value)} />
            </div>
          )}
        </Section>

        {slots.length > 0 && (
          <Section n="3" title="Book your strategy call">
            <InterviewSlotPicker slots={slots} value={f.slot} onChange={(iso) => set("slot", iso)} />
            <p className="mt-2 text-[12.5px] text-vantage-muted">Booked automatically when you submit. The invite goes to your email.</p>
          </Section>
        )}

        <label className="mt-8 flex cursor-pointer items-start gap-3 text-[13.5px] text-vantage-muted">
          <GoldCheck className="mt-0.5" checked={f.consent} onChange={() => set("consent", !f.consent)} />
          I agree to be contacted by Vantage Financial by phone, text, and email about this opportunity.
        </label>
        {errors.length > 0 && <p className="mt-4 text-[13.5px] text-destructive">Please add: {errors.join(", ")}.</p>}
        <button disabled={busy || f.us_citizen === false} onClick={onSubmit} className="vantage-btn-primary mt-6 w-full px-8 py-5 text-[17px] disabled:opacity-50">
          {busy ? "Submitting…" : "Submit & Book My Call →"}
        </button>
      </div>
    </PublicShell>
  );
}

function ProductionSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox" aria-expanded={open}
        className={cn(input, "flex items-center justify-between gap-2 text-left", value ? "text-vantage-ivory" : "text-vantage-dim/70", open && "border-vantage-gold/60")}>
        <span className={cn(!value && "text-vantage-dim/70")}>{value || "Current monthly team production *"}</span>
        <svg viewBox="0 0 16 16" className={cn("h-4 w-4 shrink-0 text-vantage-gold transition-transform duration-200", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3.5 6l4.5 4.5L12.5 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul role="listbox" className="absolute z-40 mt-2 w-full overflow-hidden rounded-[10px] border border-vantage-gold/30 bg-[#0b0b0b] py-1 shadow-[0_16px_40px_rgba(0,0,0,0.7)]">
          <li role="option" aria-selected={value === ""}
            onClick={() => { onChange(""); setOpen(false); }}
            className={cn("cursor-pointer px-4 py-2.5 text-[14px] transition-colors hover:bg-vantage-gold/10 hover:text-vantage-gold", value === "" ? "text-vantage-gold" : "text-vantage-dim")}>
            Select production range
          </li>
          {PRODUCTION.map((p) => (
            <li key={p} role="option" aria-selected={value === p}
              onClick={() => { onChange(p); setOpen(false); }}
              className={cn("flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-[14px] transition-colors hover:bg-vantage-gold/10 hover:text-vantage-gold", value === p ? "bg-vantage-gold/10 text-vantage-gold" : "text-vantage-fog")}>
              {p}
              {value === p && <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-10">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-vantage-gold/15 font-display text-vantage-gold">{n}</span>
        <h2 className="font-display text-[28px] leading-none">{title}</h2>
      </div>
      {children}
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[13px] font-semibold text-vantage-fog">{children}</div>;
}

function GoldCheck({ checked, onChange, className }: { checked: boolean; onChange: () => void; className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span aria-hidden className={cn("flex h-5 w-5 items-center justify-center rounded-[5px] border transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-vantage-gold/60",
        checked ? "border-vantage-gold bg-vantage-gold text-vantage-black shadow-[0_0_12px_rgba(201,168,76,0.45)]" : "border-white/25 bg-black/50 hover:border-vantage-gold/60")}>
        {checked && <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8.5l3 3 7-7" /></svg>}
      </span>
    </span>
  );
}
