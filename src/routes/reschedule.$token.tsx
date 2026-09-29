import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PublicShell } from "@/components/vantage/brand";
import { InterviewSlotPicker } from "@/components/vantage/interview-slot-picker";
import { Button } from "@/components/ui/button";
import { getOverviewSlots } from "@/lib/calendly.functions";
import { chooseNewInterviewTime, getRescheduleDetails } from "@/lib/reschedule.functions";

export const Route = createFileRoute("/reschedule/$token")({
  head: () => ({ meta: [
    { title: "Move your 1:1 interview — Vantage Financial" },
    { name: "description", content: "Choose a new available time for your Vantage Financial interview." },
    { property: "og:title", content: "Move your Vantage interview" },
    { property: "og:description", content: "Find a new time for your one-on-one interview." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: ReschedulePage,
});

function ReschedulePage() {
  const { token } = Route.useParams();
  const load = useServerFn(getRescheduleDetails);
  const getSlots = useServerFn(getOverviewSlots);
  const update = useServerFn(chooseNewInterviewTime);
  const details = useQuery({ queryKey: ["reschedule-applicant", token], queryFn: () => load({ data: { token } }), retry: false });
  const availability = useQuery({ queryKey: ["reschedule-slots", token], queryFn: () => getSlots(), enabled: details.data?.found === true && !details.data.legacyBooking, retry: false });
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    if (!selected || saving) return;
    setError(""); setSaving(true);
    try {
      const result = await update({ data: { token, startIso: selected } });
      if (result.ok) setConfirmed(result.startIso);
      else { setError(result.error); await availability.refetch(); setSelected(""); }
    } catch {
      setError("We couldn't confirm your new time. Please try again or reply to your interview email.");
    } finally { setSaving(false); }
  };

  return (
    <PublicShell>
      <main className="mx-auto max-w-[800px] px-5 pb-24 pt-16 md:px-8">
        <div className="vantage-eyebrow-pill mb-5 inline-flex">Vantage Financial · 1:1 interview</div>
        {details.isPending ? <p className="text-vantage-muted">Checking your interview…</p> :
        details.isError || !details.data?.found ? <div><h1 className="font-display text-5xl text-vantage-ivory">Link unavailable</h1><p className="mt-4 text-vantage-muted">We couldn't find your interview. Reply to your application email for help.</p></div> :
        confirmed ? <div aria-live="polite"><h1 className="font-display text-5xl text-vantage-ivory">Your new time is confirmed.</h1><p className="mt-5 text-vantage-muted">See you {new Date(confirmed).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} CT. A confirmation is on its way to your email.</p><Link className="mt-6 inline-block text-vantage-gold underline" to="/watch" search={{ ref: undefined }}>Watch the opportunity video before our call →</Link></div> :
        <>
          <h1 className="font-display text-[clamp(38px,6vw,64px)] leading-none text-vantage-ivory">Let's find a better time{details.data.firstName ? `, ${details.data.firstName}` : ""}.</h1>
          <p className="mt-4 max-w-[590px] text-vantage-muted">Choose a day and time below. We’ll update your 1:1 interview and email you the details.</p>
          {details.data.currentTime && <p className="mt-5 border-l-2 border-vantage-gold pl-4 text-sm text-vantage-muted">Current time: {new Date(details.data.currentTime).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} CT</p>}
          {details.data.legacyBooking && <p role="status" className="mt-6 border-l-2 border-vantage-gold pl-4 text-sm text-vantage-muted">Your original interview needs to be moved by our team. Please reply to your interview email to choose a new time without creating a second booking.</p>}
          {!details.data.legacyBooking && <div className="mt-10 border-t border-vantage-gold/25 pt-8">
            {availability.isPending ? <p className="text-vantage-muted">Finding available times…</p> : availability.isError ? <p className="text-vantage-muted">We couldn't load times. Please refresh this page or reply to your interview email.</p> : availability.data?.slots.length ? <InterviewSlotPicker slots={availability.data.slots} value={selected} onChange={setSelected} /> : <p className="text-vantage-muted">No times are currently open over the next seven days. Please reply to your interview email for help.</p>}
          </div>}
          {error && <p role="alert" className="mt-5 text-sm text-red-400">{error}</p>}
          {!details.data.legacyBooking && <Button type="button" onClick={submit} disabled={!selected || saving} className="vantage-btn-primary mt-7 h-auto px-7 py-3.5 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Confirming…" : "Confirm my new time →"}</Button>}
          <p className="mt-5 text-sm text-vantage-muted">Before we talk, <Link to="/watch" search={{ ref: undefined }} className="text-vantage-gold underline">watch the opportunity video</Link> so we can focus on you.</p>
        </>}
      </main>
    </PublicShell>
  );
}