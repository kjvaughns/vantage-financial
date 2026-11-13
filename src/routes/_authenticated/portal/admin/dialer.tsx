import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageHeader, PageBody, TableWrap, Table, THead, TH, TR, TD, Badge, EmptyState, ErrorState, TableSkeleton, Input, Field, Modal, btnClass } from "@/components/portal/ui";
import { adminSaveDialer, listDialerAgents, setDialerAccess, type DialerAgentRow } from "@/lib/dialer/dialer.functions";
import { DIALER_SHEET_URL, LEAD_TYPES, LEAD_TYPE_LABELS, US_STATES } from "@/lib/dialer/shared";

export const Route = createFileRoute("/_authenticated/portal/admin/dialer")({
  head: () => ({ meta: [{ title: "Dialer Access — Vantage Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminDialer,
});

type Filter = "all" | "active" | "requested" | "inactive" | "none";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All agents" }, { key: "active", label: "Active" }, { key: "requested", label: "Requested" },
  { key: "inactive", label: "Deactivated" }, { key: "none", label: "No access" },
];
const statusOf = (r: DialerAgentRow): Filter => (r.request ? (r.request.status as Filter) : "none");

function AdminDialer() {
  const qc = useQueryClient();
  const fn = useServerFn(listDialerAgents);
  const setFn = useServerFn(setDialerAccess);
  const q = useQuery({ queryKey: ["dialer", "admin-agents"], queryFn: () => fn() });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<DialerAgentRow | null>(null);

  const rows = useMemo(() => (q.data ?? []).filter((r) =>
    (filter === "all" || statusOf(r) === filter) && r.name.toLowerCase().includes(search.trim().toLowerCase())), [q.data, filter, search]);

  const toggle = async (r: DialerAgentRow, active: boolean) => {
    setBusy(r.user_id);
    try {
      const res = await setFn({ data: { user_id: r.user_id, active } });
      toast.success(active ? ((res as any).linked ? `${r.name} activated — existing login linked` : `${r.name} activated — waiting on a login in the sheet`) : `${r.name} deactivated`);
      qc.invalidateQueries({ queryKey: ["dialer"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update"); }
    finally { setBusy(null); }
  };

  return (
    <PortalShell>
      <PageHeader title="Dialer Access" description="Every active agent on the platform. Activate agents who already have a login in the sheet, or turn access off."
        actions={<a href={DIALER_SHEET_URL} target="_blank" rel="noreferrer" className={btnClass("primary")}>Open sheet</a>} />
      <PageBody>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agents" className="h-8 max-w-[220px] text-[13px]" />
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} className="p-focus rounded-full border px-3 py-1 text-[12.5px] font-semibold"
              style={{ borderColor: filter === f.key ? "var(--p-gold)" : "var(--p-border)", color: filter === f.key ? "var(--p-gold)" : undefined }}>
              {f.label}{q.data ? ` · ${f.key === "all" ? q.data.length : q.data.filter((r) => statusOf(r) === f.key).length}` : ""}
            </button>
          ))}
        </div>
        {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState title="Couldn't load agents" description={(q.error as Error).message} /> :
          !rows.length ? <EmptyState title="No agents match" /> : (
          <TableWrap><Table>
            <THead><tr><TH>Agent</TH><TH>Lead types</TH><TH>States</TH><TH>Dialer login</TH><TH>Status</TH><TH></TH></tr></THead>
            <tbody>{rows.map((r) => {
              const s = statusOf(r);
              const login = r.request?.dialer_username || r.sheet_username;
              return (
                <TR key={r.user_id}>
                  <TD><div className="font-semibold">{r.name}</div>{r.email && <div className="p-secondary text-[12px]">{r.email}</div>}</TD>
                  <TD>{r.request?.lead_types.join(", ") || "—"}</TD>
                  <TD className="max-w-[220px] truncate">{r.request?.states.join(", ") || "—"}</TD>
                  <TD>{login ? <code className="text-[12.5px]">{login}</code> : r.in_sheet ? <span className="p-secondary">In sheet, no login</span> : <span className="p-secondary">—</span>}</TD>
                  <TD>{s === "active" ? <Badge tone="green">Active</Badge> : s === "requested" ? <Badge tone="amber">Requested</Badge> : s === "inactive" ? <Badge>Deactivated</Badge> : <span className="p-secondary">No access</span>}</TD>
                  <TD className="text-right whitespace-nowrap">
                    <button className={btnClass("ghost", "sm")} onClick={() => setEditing(r)}>Edit</button>{" "}
                    {s === "active" || s === "requested"
                      ? <button className={btnClass("secondary", "sm")} disabled={busy === r.user_id} onClick={() => toggle(r, false)}>Deactivate</button>
                      : <button className={btnClass("primary", "sm")} disabled={busy === r.user_id} onClick={() => toggle(r, true)}>Activate</button>}
                  </TD>
                </TR>);
            })}</tbody>
          </Table></TableWrap>)}
      </PageBody>
      {editing && <EditDialer row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["dialer"] }); }} />}
    </PortalShell>
  );
}

function EditDialer({ row, onClose, onSaved }: { row: DialerAgentRow; onClose: () => void; onSaved: () => void }) {
  const saveFn = useServerFn(adminSaveDialer);
  const [name, setName] = useState(row.request?.agent_name ?? row.name);
  const [leads, setLeads] = useState<string[]>(row.request?.lead_types ?? []);
  const [states, setStates] = useState<string[]>(row.request?.states ?? []);
  const [username, setUsername] = useState(row.request?.dialer_username ?? row.sheet_username ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const save = async () => {
    setSaving(true);
    try {
      await saveFn({ data: { user_id: row.user_id, agent_name: name, lead_types: leads, states, username, password: password || undefined } });
      toast.success(`Saved ${name} — sheet updated`); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); } finally { setSaving(false); }
  };
  const chip = (on: boolean) => ({ borderColor: on ? "var(--p-gold)" : "var(--p-border)", background: on ? "var(--p-gold)" : "transparent", color: on ? "var(--p-bg, #000)" : undefined });
  return (
    <Modal title={`Edit dialer — ${row.name}`} description="Changes are written straight to the Google Sheet." onClose={onClose} width={620}
      footer={<><button className={btnClass("ghost")} onClick={onClose}>Cancel</button>
        <button className={btnClass("primary")} disabled={saving || name.trim().length < 3} onClick={save}>{saving ? "Saving…" : "Save"}</button></>}>
      <div className="space-y-4">
        <Field label="Name on sheet"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dialer username"><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Not set yet" /></Field>
          <Field label="Dialer password"><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={row.request?.has_password ? "Leave blank to keep current" : "Not set yet"} autoComplete="off" /></Field>
        </div>
        <div>
          <span className="p-label mb-2 block">Lead types</span>
          <div className="flex flex-wrap gap-2">
            {LEAD_TYPES.map((t) => (
              <button key={t} type="button" aria-pressed={leads.includes(t)} onClick={() => setLeads((l) => toggle(l, t))}
                className="p-focus rounded-full border px-3 py-1 text-[12.5px] font-semibold" style={chip(leads.includes(t))}>
                {t} · {LEAD_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="p-label mb-2 block">States <span className="p-secondary">({states.length})</span></span>
          <div className="grid grid-cols-7 gap-1 sm:grid-cols-10">
            {US_STATES.map((s) => (
              <button key={s} type="button" aria-pressed={states.includes(s)} onClick={() => setStates((x) => toggle(x, s))}
                className="p-focus h-7 rounded-[6px] border text-[11.5px] font-semibold" style={chip(states.includes(s))}>{s}</button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
