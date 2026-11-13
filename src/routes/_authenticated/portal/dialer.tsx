import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, ExternalLink, Eye, EyeOff, Minus, Plus, Search, Send } from "lucide-react";
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
  const [addL, setAddL] = useState<string[]>([]);
  const [remL, setRemL] = useState<string[]>([]);
  const [addS, setAddS] = useState<string[]>([]);
  const [remS, setRemS] = useState<string[]>([]);
  const [showAllStates, setShowAllStates] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (q.data) setName(q.data.request?.agent_name ?? q.data.defaultName);
  }, [q.data]);

  const req = q.data?.request;
  const leads = req?.lead_types ?? [];
  const states = req?.states ?? [];
  const tog = (set: (f: (p: string[]) => string[]) => void) => (v: string) => set((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const nextLeads = [...leads.filter((x) => !remL.includes(x)), ...addL];
  const nextStates = [...states.filter((x) => !remS.includes(x)), ...addS];
  const changes = addL.length + remL.length + addS.length + remS.length;
  const blocker = !changes ? "" : name.trim().length < 3 ? "Enter your first and last name."
    : !nextLeads.length ? "Keep or add at least one lead type." : !nextStates.length ? "Keep or add at least one state." : "";
  const availStates = US_STATES.filter((s) => !states.includes(s) && s.includes(search.trim()));

  const reset = () => { setAddL([]); setRemL([]); setAddS([]); setRemS([]); setShowAllStates(false); setSearch(""); };
  const submit = async () => {
    setSaving(true);
    try {
      await saveFn({ data: { agent_name: name, lead_types: nextLeads, states: nextStates } });
      toast.success("Request sent to dialer support");
      reset();
      qc.invalidateQueries({ queryKey: ["dialer"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send request");
    } finally { setSaving(false); }
  };
  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copied"); };
  const initials = (req?.agent_name ?? name).split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <PortalShell>
      <PageHeader title="Dialer Support" description="Manage your dialer lead types and states. Dialer support reviews requests every morning." />
      <PageBody>
        {q.isError ? <ErrorState title="Couldn't load your dialer info" description={(q.error as Error).message} /> : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <Panel>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full text-[15px] font-bold" style={{ background: "color-mix(in oklab, var(--p-gold) 18%, transparent)", color: "var(--p-gold)" }}>{initials || "?"}</div>
              <div className="min-w-0 flex-1">
                <div className="p-label">Your account</div>
                <div className="truncate text-[15px] font-semibold">{req?.agent_name ?? (name || "—")}</div>
              </div>
              {!req ? <Badge tone="neutral">No account</Badge> : req.status === "inactive" ? <Badge tone="neutral" dot>Deactivated</Badge> : req.dialer_username ? <Badge tone="green" dot>Active</Badge> : <Badge tone="amber" dot>Pending</Badge>}
            </div>
            <div className="mt-4 rounded-[10px] border p-3" style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}>
              {req?.status === "inactive" ? <p className="p-secondary text-[13px]">Your dialer access is turned off. Reach out to your upline if this is a mistake.</p>
                : req?.dialer_username ? (
                  <div className="space-y-2.5 text-[13.5px]">
                    <Cred label="Username" value={req.dialer_username} onCopy={copy} />
                    {q.data?.password && (
                      <div>
                        <div className="p-label mb-0.5">Password</div>
                        <div className="flex items-center gap-1">
                          <code className="flex-1 truncate">{showPw ? q.data.password : "••••••••"}</code>
                          <button className={btnClass("ghost", "sm")} onClick={() => setShowPw((v) => !v)} aria-label="Show password">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                          <button className={btnClass("ghost", "sm")} onClick={() => copy(q.data!.password!)} aria-label="Copy password"><Copy className="h-4 w-4" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : <p className="p-secondary text-[13px]">{req ? "Your login shows here as soon as dialer support sets it up." : "Send your first request and your login shows here once it's ready."}</p>}
            </div>
            <a href="https://brightclips.readymode.com/" target="_blank" rel="noopener noreferrer" className={btnClass("primary") + " mt-3 w-full justify-center"}>
              <ExternalLink className="h-4 w-4" /> Open dialer
            </a>
            <div className="mt-4 space-y-3">
              <Chips label="Active lead types" items={leads} />
              <Chips label={`Active states${states.length ? ` (${states.length})` : ""}`} items={states} />
            </div>
          </Panel>

          <Panel title="Make a request">
            <div className="space-y-5">
              {!req && (
                <Field label="First and last name" required>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
                </Field>
              )}
              <Section title="Lead types" hint="Tap one you have to remove it, or one you don't to add it.">
                <div className="flex flex-wrap gap-1.5">
                  {LEAD_TYPES.map((t) => {
                    const has = leads.includes(t);
                    const state = has ? (remL.includes(t) ? "remove" : "have") : addL.includes(t) ? "add" : "none";
                    return <Pill key={t} state={state} onClick={() => (has ? tog(setRemL)(t) : tog(setAddL)(t))}>{t} <span className="opacity-70 font-normal">· {LEAD_TYPE_LABELS[t as keyof typeof LEAD_TYPE_LABELS]}</span></Pill>;
                  })}
                </div>
              </Section>
              <Section title="States" hint="Tap a state you have to remove it.">
                <div className="flex flex-wrap gap-1.5">
                  {states.length === 0 && <span className="p-secondary text-[13px]">No states yet.</span>}
                  {states.map((s) => <Pill key={s} state={remS.includes(s) ? "remove" : "have"} onClick={() => tog(setRemS)(s)}>{s}</Pill>)}
                  {addS.map((s) => <Pill key={s} state="add" onClick={() => tog(setAddS)(s)}>{s}</Pill>)}
                  {states.length < US_STATES.length && (
                    <button type="button" onClick={() => setShowAllStates((v) => !v)} className="p-focus inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-[12.5px] font-semibold" style={{ borderColor: "var(--p-gold)", color: "var(--p-gold)" }}>
                      <Plus className="h-3.5 w-3.5" /> {showAllStates ? "Done" : "Add states"}
                    </button>
                  )}
                </div>
                {showAllStates && (
                  <div className="mt-2 rounded-[10px] border p-2" style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}>
                    <div className="relative mb-2">
                      <Search className="p-secondary pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value.toUpperCase())} placeholder="Search (e.g. TX)" className="h-8 pl-8 text-[13px]" />
                    </div>
                    <div className="grid grid-cols-7 gap-1 sm:grid-cols-10 lg:grid-cols-13">
                      {availStates.map((s) => { const on = addS.includes(s); return (
                        <button key={s} type="button" aria-pressed={on} onClick={() => tog(setAddS)(s)}
                          className="p-focus h-7 rounded-[6px] border text-[11.5px] font-semibold transition-colors"
                          style={{ borderColor: on ? "var(--p-gold)" : "var(--p-border)", background: on ? "var(--p-gold)" : "transparent", color: on ? "var(--p-bg, #000)" : undefined }}>{s}</button>); })}
                    </div>
                  </div>
                )}
              </Section>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: "var(--p-border)" }}>
                <div className="text-[13px]">
                  {blocker ? <span style={{ color: "var(--p-red, #e5484d)" }}>{blocker}</span>
                    : changes ? <Summary add={[...addL, ...addS]} remove={[...remL, ...remS]} />
                    : <span className="p-secondary">No changes selected.</span>}
                </div>
                <div className="flex gap-2">
                  {changes > 0 && <button type="button" className={btnClass("ghost", "sm")} onClick={reset}>Clear</button>}
                  <button type="button" className={btnClass("primary", "sm")} disabled={saving || q.isLoading || !changes || !!blocker} onClick={submit}>
                    <Send className="h-4 w-4" /> {saving ? "Sending…" : "Request"}
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        </div>)}
      </PageBody>
    </PortalShell>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2"><span className="p-label">{title}</span><span className="p-secondary text-[12px]">{hint}</span></div>
      {children}
    </div>
  );
}

function Pill({ state, onClick, children }: { state: "have" | "remove" | "add" | "none"; onClick: () => void; children: React.ReactNode }) {
  const st = {
    have: { borderColor: "var(--p-gold)", color: "var(--p-gold)", background: "color-mix(in oklab, var(--p-gold) 10%, transparent)" },
    remove: { borderColor: "var(--p-red, #e5484d)", color: "var(--p-red, #e5484d)", background: "transparent", textDecoration: "line-through" },
    add: { borderColor: "var(--p-gold)", color: "var(--p-bg, #000)", background: "var(--p-gold)" },
    none: { borderColor: "var(--p-border)", background: "transparent" },
  }[state];
  return (
    <button type="button" onClick={onClick} className="p-focus inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors" style={st}>
      {state === "add" && <Plus className="h-3.5 w-3.5" />}{state === "remove" && <Minus className="h-3.5 w-3.5" />}{children}
    </button>
  );
}

function Summary({ add, remove }: { add: string[]; remove: string[] }) {
  return (
    <span className="flex flex-wrap gap-x-3">
      {add.length > 0 && <span><span style={{ color: "var(--p-gold)" }} className="font-semibold">Add:</span> {add.join(", ")}</span>}
      {remove.length > 0 && <span><span style={{ color: "var(--p-red, #e5484d)" }} className="font-semibold">Remove:</span> {remove.join(", ")}</span>}
    </span>
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
