import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

const searchSchema = z.object({ track: z.enum(["builder", "owner"]).optional() });

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

function AgencyApply() {
  const { track: initialTrack } = Route.useSearch();
  const navigate = useNavigate();
  const submit = useServerFn(submitApplication);
  const fetchSlots = useServerFn(getOverviewSlots);
  const slotsQuery = useQuery({ queryKey: ["overview-slots"], queryFn: () => fetchSlots(), retry: false, staleTime: 300000 });
  const slots = slotsQuery.data?.slots ?? [];

  const [track, setTrack] = useState<Track | null>(initialTrack ?? null);
  const [f, setF] = useState({
    first_name: "", last_name: "", email: "", phone: "", state: "",
    us_citizen: null as boolean | null, licensed: null as boolean | null,
    npn: "", current_imo: "", team_size: "", production: "", goals: "", slot: "", consent: false,
  });
  const [ref, setRef] = useState<ReturnType<typeof getReferral>>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => setRef(getReferral()), []);
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
    if (f.team_size === "" || Number(f.team_size) < 0) e.push("team size");
    if (!f.production) e.push("monthly production");
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
          why_text: `[Agency – ${label}] ${f.goals.trim() || "Interested in the agency track."}`.padEnd(10, "."),
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
            track, team_size: Number(f.team_size), monthly_production: f.production,
            current_imo: f.current_imo.trim(), npn: f.npn.trim(), goals: f.goals.trim(),
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

        <Section n="1" title="Pick your track">
          <div className="grid gap-3 sm:grid-cols-2">
            {TRACKS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTrack(t.id)}
                className={cn("vantage-card p-4 text-left", track === t.id && "border-vantage-gold bg-vantage-gold/10")}>
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
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <input className={input} placeholder="NPN (optional)" value={f.npn} onChange={(e) => set("npn", e.target.value)} />
            <input className={input} placeholder="Current agency / IMO" value={f.current_imo} onChange={(e) => set("current_imo", e.target.value)} />
            <input className={input} type="number" min={0} placeholder="Agents on your team *" value={f.team_size} onChange={(e) => set("team_size", e.target.value)} />
            <select className={input} value={f.production} onChange={(e) => set("production", e.target.value)}>
              <option value="">Monthly team production *</option>
              {PRODUCTION.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <textarea className={cn(input, "mt-4 min-h-[110px]")} placeholder="What are your agency goals for the next 12 months?" value={f.goals} onChange={(e) => set("goals", e.target.value)} />
        </Section>

        {slots.length > 0 && (
          <Section n="3" title="Book your strategy call">
            <InterviewSlotPicker slots={slots} value={f.slot} onChange={(iso) => set("slot", iso)} />
            <p className="mt-2 text-[12.5px] text-vantage-muted">Booked automatically when you submit. The invite goes to your email.</p>
          </Section>
        )}

        <label className="mt-8 flex items-start gap-3 text-[13.5px] text-vantage-muted">
          <input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
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
