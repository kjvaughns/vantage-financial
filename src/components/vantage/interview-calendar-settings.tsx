import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Unplug } from "lucide-react";
import { Panel, Button, Field, Input, Badge, ErrorState, TextSkeleton, notify } from "@/components/portal/ui";
import { getInterviewCalendarSettings, saveInterviewCalendar, testInterviewCalendar, disconnectInterviewCalendar } from "@/lib/interview/calendar.functions";
export function InterviewCalendarSettings({ ownerId }: { ownerId?: string }) {
  const get = useServerFn(getInterviewCalendarSettings);
  const save = useServerFn(saveInterviewCalendar);
  const test = useServerFn(testInterviewCalendar);
  const disconnect = useServerFn(disconnectInterviewCalendar);
  const qc = useQueryClient();
  const queryKey = ["interview-calendar", ownerId ?? "me"];
  const q = useQuery({ queryKey, queryFn: () => get({ data: { ownerId } }), retry: false });
  const [form, setForm] = useState<{ username: string; eventSlug: string; timezone: string; apiKey: string; format: "one_on_one" | "group" }>({ username: "", eventSlug: "", timezone: "America/Chicago", apiKey: "", format: "one_on_one" });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (q.data) setForm({ username: q.data.username, eventSlug: q.data.eventSlug, timezone: q.data.timezone, apiKey: "", format: q.data.format }); }, [q.data]);
  async function act(action: "test" | "save" | "disconnect") {
    if (action === "disconnect" && !window.confirm("Use the company calendar for new applicants? Existing interviews stay on this calendar.")) return;
    setBusy(action); setMessage(""); setError("");
    try {
      if (action === "disconnect") await disconnect({ data: { ownerId } });
      else if (action === "test") await test({ data: { ...form, ownerId } });
      else await save({ data: { ...form, ownerId } });
      setMessage(action === "test" ? "Connection verified. Ready for automatic booking." : action === "save" ? "Calendar connected for this leader and their team." : "New applicants will use the company calendar.");
      if (action !== "test") { setForm((f) => ({ ...f, apiKey: "" })); await qc.invalidateQueries({ queryKey }); }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update calendar."); }
    finally { setBusy(""); }
  }
  return <Panel title={<span className="inline-flex items-center gap-2"><CalendarDays size={17} />Interview scheduling · Cal.com</span>} actions={<Badge tone={q.data?.connected ? "green" : "neutral"}>{q.data?.connected ? "Connected" : "Company calendar"}</Badge>}>
    {q.isPending ? <TextSkeleton lines={3} /> : q.isError ? <ErrorState description={q.error.message} onRetry={() => q.refetch()} /> : <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cal.com username" hint="cal.com/your-name/interview"><Input value={form.username} onChange={(e) => { setMessage(""); setForm({ ...form, username: e.target.value }); }} placeholder="your-name" /></Field>
        <Field label="Interview event slug"><Input value={form.eventSlug} onChange={(e) => { setMessage(""); setForm({ ...form, eventSlug: e.target.value }); }} placeholder="interview" /></Field>
        <Field label="Cal.com API key" hint={q.data?.connected ? "Stored securely. Leave blank to keep it." : "Cal.com → Settings → Developer → API Keys"}><Input type="password" autoComplete="new-password" value={form.apiKey} onChange={(e) => { setMessage(""); setForm({ ...form, apiKey: e.target.value }); }} placeholder={q.data?.connected ? "Saved key" : "Enter API key"} /></Field>
        <Field label="Timezone"><Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="America/Chicago" /></Field>
      </div>
      <Field label="Interview type" hint="Shown to applicants on the apply page. Save to apply changes.">
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {([["one_on_one", "1:1 interview"], ["group", "Group interview"]] as const).map(([v, l]) => <Button key={v} type="button" role="radio" aria-checked={form.format === v} variant={form.format === v ? "primary" : "secondary"} onClick={() => { setMessage(""); setForm({ ...form, format: v }); }}>{l}</Button>)}
        </div>
      </Field>
      {error && <p role="alert" className="p-secondary">{error}</p>}
      {message && <p role="status" className="p-secondary inline-flex items-center gap-2"><CheckCircle2 size={15} />{message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => act("test")} disabled={!!busy || !form.username || !form.eventSlug}>{busy === "test" ? "Testing…" : "Test connection"}</Button>
        <Button onClick={() => act("save")} disabled={!!busy || !form.username || !form.eventSlug}>{busy === "save" ? "Connecting…" : "Save calendar"}</Button>
        {q.data?.connected && <Button variant="ghost" onClick={() => act("disconnect")} disabled={!!busy}><Unplug size={15} />Disconnect</Button>}
      </div>
    </div>}
  </Panel>;
}
