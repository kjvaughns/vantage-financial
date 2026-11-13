import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Copy, Eye, EyeOff, Search, Send } from "lucide-react";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageHeader, PageBody, Panel, Badge, Field, Input, ErrorState, btnClass } from "@/components/portal/ui";
import { getMyDialer, saveDialerRequest } from "@/lib/dialer/dialer.functions";
import { LEAD_TYPES, LEAD_TYPE_LABELS, US_STATES } from "@/lib/dialer/shared";

export const Route = createFileRoute("/_authenticated/portal/dialer")({
  head: () => ({ meta: [{ title: "Dialer Support — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: DialerPage,
});

type Action = "add_lead" | "remove_lead" | "add_state" | "remove_state";
const ACTIONS: { id: Action; label: string }[] = [
  { id: "add_lead", label: "Add lead type" },
  { id: "remove_lead", label: "Remove lead type" },
  { id: "add_state", label: "Add states" },
  { id: "remove_state", label: "Remove states" },
];

function DialerPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyDialer);
  const saveFn = useServerFn(saveDialerRequest);
  const q = useQuery({ queryKey: ["dialer", "me"], queryFn: () => getFn() });
  const [name, setName] = useState("");
  const [action, setAction] = useState<Action>("add_lead");
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    setName(q.data.request?.agent_name ?? q.data.defaultName);
  }, [q.data]);
  useEffect(() => { setPicked([]); setSearch(""); }, [action]);

  const req = q.data?.request;
  const leads = req?.lead_types ?? [];
  const states = req?.states ?? [];
  const isLead = action === "add_lead" || action === "remove_lead";
  const options: string[] =
    action === "add_lead" ? LEAD_TYPES.filter((t) => !leads.includes(t))
    : action === "remove_lead" ? leads
    : action === "add_state" ? US_STATES.filter((s) => !states.includes(s))
    : states;
  const shown = isLead ? options : options.filter((s) => s.includes(search.trim()));
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  const nextLeads = action === "add_lead" ? [...leads, ...picked] : action === "remove_lead" ? leads.filter((x) => !picked.includes(x)) : leads;
  const nextStates = action === "add_state" ? [...states, ...picked] : action === "remove_state" ? states.filter((x) => !picked.includes(x)) : states;
  const blocker = !picked.length ? "" : name.trim().length < 3 ? "Enter your first and last name."
    : !nextLeads.length ? (req ? "You need to keep at least one lead type." : "Also request at least one lead type.")
    : !nextStates.length ? (req ? "You need to keep at least one state." : "Also request at least one state.") : "";

  const submit = async () => {
    setSaving(true);
    try {
      await saveFn({ data: { agent_name: name, lead_types: nextLeads, states: nextStates } });
      toast.success("Request sent");
      setPicked([]);
      qc.invalidateQueries({ queryKey: ["dialer"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send request");
    } finally { setSaving(false); }
  };
  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copied"); };
  const tile = (on: boolean) => ({ borderColor: on ? "var(--p-gold)" : "var(--p-border)", background: on ? "var(--p-gold)" : "transparent", color: on ? "var(--p-bg, #000)" : undefined });

  return (
    <PortalShell>
      <PageHeader title="Dialer Support" description="Request lead type or state changes. Dialer support reviews new requests every morning." />
      <PageBody>
        {q.isError ? <ErrorState title="Couldn't load your dialer info" description={(q.error as Error).message} /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Panel title="New request">
            <div className="space-y-4">
              {!req && (
                <Field label="First and last name" required>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
                </Field>
              )}
              <div>
                <span className="p-label mb-2 block">What do you need?</span>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {ACTIONS.map((a) => (
                    <button key={a.id} type="button" aria-pressed={action === a.id} onClick={() => setAction(a.id)}
                      className="p-focus rounded-[8px] border px-2 py-1.5 text-[12.5px] font-semibold transition-colors"
                      style={{ borderColor: action === a.id ? "var(--p-gold)" : "var(--p-border)", color: action === a.id ? "var(--p-gold)" : undefined, background: action === a.id ? "color-mix(in oklab, var(--p-gold) 12%, transparent)" : "var(--p-raised)" }}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-[10px] border p-2" style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}>
                {!isLead && options.length > 8 && (
                  <div className="relative mb-2">
                    <Search className="p-secondary pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value.toUpperCase())} placeholder="Search states (e.g. TX)" className="h-8 pl-8 text-[13px]" />
                  </div>
                )}
                {shown.length === 0 ? (
                  <p className="p-secondary p-1 text-[13px]">
                    {options.length ? "No matching states." : action === "add_lead" ? "You already have every lead type." : action === "add_state" ? "You already have every state." : `You don't have any ${isLead ? "lead types" : "states"} yet.`}
                  </p>
                ) : isLead ? (
                  <div className="grid gap-1.5 sm:grid-cols-3">
                    {shown.map((t) => { const on = picked.includes(t); return (
                      <button key={t} type="button" aria-pressed={on} onClick={() => toggle(t)}
                        className="p-focus flex items-center gap-2 rounded-[8px] border px-2.5 py-1.5 text-left transition-colors"
                        style={{ borderColor: on ? "var(--p-gold)" : "var(--p-border)", background: on ? "color-mix(in oklab, var(--p-gold) 12%, transparent)" : "transparent" }}>
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border" style={{ borderColor: on ? "var(--p-gold)" : "var(--p-border)", background: on ? "var(--p-gold)" : "transparent" }}>
                          {on && <Check className="h-3.5 w-3.5" style={{ color: "var(--p-bg, #000)" }} strokeWidth={3} />}
                        </span>
                        <span><span className="block text-[13.5px] font-semibold" style={{ color: on ? "var(--p-gold)" : undefined }}>{t}</span>
                          <span className="p-secondary block text-[12px]">{LEAD_TYPE_LABELS[t as keyof typeof LEAD_TYPE_LABELS]}</span></span>
                      </button>); })}
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-1 sm:grid-cols-10 lg:grid-cols-13">
                    {shown.map((s) => { const on = picked.includes(s); return (
                      <button key={s} type="button" aria-pressed={on} onClick={() => toggle(s)}
                        className="p-focus h-7 rounded-[6px] border text-[11.5px] font-semibold transition-colors" style={tile(on)}>{s}</button>); })}
                  </div>
                )}
              </div>
              {blocker && <p className="text-[13px]" style={{ color: "var(--p-red, #e5484d)" }}>{blocker}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="p-secondary text-[13px]">{picked.length ? `${ACTIONS.find((a) => a.id === action)!.label}: ${picked.join(", ")}` : "Tap items above to select them."}</span>
                <button type="button" className={btnClass("primary", "sm")} disabled={saving || q.isLoading || !picked.length || !!blocker} onClick={submit}>
                  <Send className="h-4 w-4" /> {saving ? "Sending…" : "Request"}
                </button>
              </div>
            </div>
          </Panel>
          <Panel title="Your account">
            {!req ? <p className="p-secondary">No dialer account yet. Request a lead type and states, and your login shows here once dialer support sets it up.</p> : (
              <div className="space-y-3 text-[13.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{req.agent_name}</span>
                  {req.status === "inactive" ? <Badge tone="neutral" dot>Deactivated</Badge> : req.dialer_username ? <Badge tone="green" dot>Active</Badge> : <Badge tone="amber" dot>Requested</Badge>}
                </div>
                {req.status === "inactive" ? <p className="p-secondary">Your dialer access is turned off. Reach out to your upline if this is a mistake.</p>
                  : req.dialer_username ? (<>
                    <Cred label="Username" value={req.dialer_username} onCopy={copy} />
                    {q.data?.password && (
                      <div>
                        <div className="p-label mb-1">Password</div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 truncate">{showPw ? q.data.password : "••••••••"}</code>
                          <button className={btnClass("ghost", "sm")} onClick={() => setShowPw((v) => !v)} aria-label="Show password">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                          <button className={btnClass("ghost", "sm")} onClick={() => copy(q.data!.password!)} aria-label="Copy password"><Copy className="h-4 w-4" /></button>
                        </div>
                      </div>
                    )}
                  </>) : <p className="p-secondary">Your login appears here automatically once dialer support sets it up.</p>}
                <Chips label="Lead types" items={leads} />
                <Chips label="States" items={states} />
              </div>
            )}
          </Panel>
        </div>)}
      </PageBody>
    </PortalShell>
  );
}

function Chips({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="p-label mb-1">{label}</div>
      {items.length ? <div className="flex flex-wrap gap-1">{items.map((i) => (
        <span key={i} className="rounded-full border px-2 py-0.5 text-[12px] font-semibold" style={{ borderColor: "var(--p-gold)", color: "var(--p-gold)" }}>{i}</span>))}</div>
        : <span className="p-secondary text-[13px]">None yet</span>}
    </div>
  );
}

function Cred({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string) => void }) {
  return (
    <div>
      <div className="p-label mb-1">{label}</div>
      <div className="flex items-center gap-2"><code className="flex-1 truncate">{value}</code>
        <button className={btnClass("ghost", "sm")} onClick={() => onCopy(value)} aria-label={`Copy ${label}`}><Copy className="h-4 w-4" /></button></div>
    </div>
  );
}
