import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, X } from "lucide-react";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageHeader, PageBody, Panel, Badge, Field, Input, Checkbox, ErrorState, btnClass } from "@/components/portal/ui";
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
  const [pick, setPick] = useState("");
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
  const save = async () => {
    setSaving(true);
    try {
      await saveFn({ data: { agent_name: name, lead_types: leads, states } });
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
                <div className="flex flex-wrap gap-4">
                  {LEAD_TYPES.map((t) => (
                    <Checkbox key={t} checked={leads.includes(t)} label={`${t} · ${LEAD_TYPE_LABELS[t]}`}
                      onChange={(v) => setLeads((l) => (v ? [...l, t] : l.filter((x) => x !== t)))} />
                  ))}
                </div>
              </div>
              <div>
                <span className="p-label mb-2 block">States</span>
                <div className="mb-3 flex flex-wrap gap-2">
                  {states.length === 0 && <span className="p-secondary">No states added yet.</span>}
                  {states.map((s) => (
                    <button key={s} type="button" onClick={() => setStates((x) => x.filter((y) => y !== s))}
                      className="p-focus inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] font-semibold"
                      style={{ borderColor: "var(--p-gold)", color: "var(--p-gold)" }} aria-label={`Remove ${s}`}>
                      {s} <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <select value={pick} onChange={(e) => setPick(e.target.value)}
                    className="p-focus h-10 rounded-[10px] border bg-transparent px-3 text-[13.5px]" style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}>
                    <option value="">Add a state…</option>
                    {US_STATES.filter((s) => !states.includes(s)).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" className={btnClass("secondary")} disabled={!pick}
                    onClick={() => { setStates((x) => [...x, pick]); setPick(""); }}>Add</button>
                </div>
              </div>
              <button type="button" className={btnClass("primary")} disabled={saving || q.isLoading || name.trim().length < 3 || !leads.length || !states.length} onClick={save}>
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
