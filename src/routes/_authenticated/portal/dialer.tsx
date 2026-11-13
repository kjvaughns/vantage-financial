import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Copy, Eye, EyeOff, Plus, Search, X } from "lucide-react";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageHeader, PageBody, Panel, Badge, Field, Input, ErrorState, btnClass } from "@/components/portal/ui";
import { getMyDialer, saveDialerRequest } from "@/lib/dialer/dialer.functions";
import { LEAD_TYPES, LEAD_TYPE_LABELS, US_STATES } from "@/lib/dialer/shared";

export const Route = createFileRoute("/_authenticated/portal/dialer")({
  head: () => ({ meta: [{ title: "Dialer Support — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: DialerPage,
});

function DialerPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyDialer);
  const saveFn = useServerFn(saveDialerRequest);
  const q = useQuery({ queryKey: ["dialer", "me"], queryFn: () => getFn() });
  const [name, setName] = useState("");
  const [leads, setLeads] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    const r = q.data.request;
    setName(r?.agent_name ?? q.data.defaultName);
    setLeads(r?.lead_types ?? []);
    setStates(r?.states ?? []);
  }, [q.data]);

  const req = q.data?.request;
  const available = US_STATES.filter((s) => !states.includes(s) && s.includes(search.trim()));
  const save = async (nextStates: string[] = states) => {
    setSaving(true);
    try {
      await saveFn({ data: { agent_name: name, lead_types: leads, states: nextStates } });
      toast.success(req ? "Dialer request updated" : "Dialer login requested");
      qc.invalidateQueries({ queryKey: ["dialer"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save request");
    } finally { setSaving(false); }
  };
  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copied"); };

  return (
    <PortalShell>
      <PageHeader title="Dialer Support" description="Request your dialer login and choose the leads and states you want. Dialer support reviews new requests every morning." />
      <PageBody>
        {q.isError ? <ErrorState title="Couldn't load your dialer info" description={(q.error as Error).message} /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Panel title={req ? "Your dialer request" : "Request a dialer login"}>
            <div className="space-y-5">
              <Field label="First and last name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
              </Field>
              <div>
                <span className="p-label mb-2 block">Lead types</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {LEAD_TYPES.map((t) => {
                    const on = leads.includes(t);
                    return (
                      <button key={t} type="button" aria-pressed={on}
                        onClick={() => setLeads((l) => (on ? l.filter((x) => x !== t) : [...l, t]))}
                        className="p-focus flex items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-colors"
                        style={{ borderColor: on ? "var(--p-gold)" : "var(--p-border)", background: on ? "color-mix(in oklab, var(--p-gold) 12%, transparent)" : "var(--p-raised)" }}>
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border"
                          style={{ borderColor: on ? "var(--p-gold)" : "var(--p-border)", background: on ? "var(--p-gold)" : "transparent" }}>
                          {on && <Check className="h-3.5 w-3.5" style={{ color: "var(--p-bg, #000)" }} strokeWidth={3} />}
                        </span>
                        <span>
                          <span className="block text-[13.5px] font-semibold" style={{ color: on ? "var(--p-gold)" : undefined }}>{t}</span>
                          <span className="p-secondary block text-[12px]">{LEAD_TYPE_LABELS[t]}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <span className="p-label mb-2 block">Your states</span>
                <div className="mb-4 flex flex-wrap gap-2">
                  {states.length === 0 && <span className="p-secondary">No states yet — tap states below to add them.</span>}
                  {states.map((s) => (
                    <button key={s} type="button" onClick={() => setStates((x) => x.filter((y) => y !== s))}
                      className="p-focus inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] font-semibold"
                      style={{ borderColor: "var(--p-gold)", color: "var(--p-gold)" }} aria-label={`Remove ${s}`}>
                      {s} <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
                <div className="rounded-[12px] border p-3" style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="p-secondary pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value.toUpperCase())} placeholder="Search states (e.g. TX)" className="pl-8" />
                    </div>
                    {pending.length > 0 && <button type="button" className={btnClass("ghost", "sm")} onClick={() => setPending([])}>Clear</button>}
                  </div>
                  {available.length === 0 ? <p className="p-secondary text-[13px]">{states.length === US_STATES.length ? "You already have every state." : "No matching states."}</p> : (
                    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 lg:grid-cols-10">
                      {available.map((s) => {
                        const on = pending.includes(s);
                        return (
                          <button key={s} type="button" aria-pressed={on}
                            onClick={() => setPending((p) => (on ? p.filter((x) => x !== s) : [...p, s]))}
                            className="p-focus h-9 rounded-[8px] border text-[12.5px] font-semibold transition-colors"
                            style={{ borderColor: on ? "var(--p-gold)" : "var(--p-border)", background: on ? "var(--p-gold)" : "transparent", color: on ? "var(--p-bg, #000)" : undefined }}>
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {pending.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--p-border)" }}>
                      <span className="p-secondary text-[13px]">{pending.length} selected: {pending.join(", ")}</span>
                      <button type="button" className={btnClass("primary", "sm")} disabled={saving || name.trim().length < 3 || !leads.length}
                        onClick={() => { const next = [...states, ...pending]; setStates(next); setPending([]); void save(next); }}>
                        <Plus className="h-4 w-4" /> Request {pending.length === 1 ? "state" : "states"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button type="button" className={btnClass("primary")} disabled={saving || q.isLoading || name.trim().length < 3 || !leads.length || !states.length} onClick={() => save()}>
                {saving ? "Saving…" : req ? "Save changes" : "Request dialer login"}
              </button>
            </div>
          </Panel>
          <Panel title="Your login">
            {!req ? <p className="p-secondary">Submit a request and your login will show here once dialer support sets it up.</p> :
              req.dialer_username ? (
                <div className="space-y-3 text-[13.5px]">
                  <Badge tone="green" dot>Active</Badge>
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
                </div>
              ) : (
                <div className="space-y-2"><Badge tone="amber" dot>Requested</Badge>
                  <p className="p-secondary">Dialer support has your request. Your login appears here automatically once it's ready.</p></div>
              )}
          </Panel>
        </div>)}
      </PageBody>
    </PortalShell>
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
