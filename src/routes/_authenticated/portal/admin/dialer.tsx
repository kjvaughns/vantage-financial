import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageHeader, PageBody, TableWrap, Table, THead, TH, TR, TD, Badge, EmptyState, ErrorState, TableSkeleton, Input, btnClass } from "@/components/portal/ui";
import { listDialerAgents, setDialerAccess, type DialerAgentRow } from "@/lib/dialer/dialer.functions";
import { DIALER_SHEET_URL } from "@/lib/dialer/shared";

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
                  <TD className="text-right">
                    {s === "active" || s === "requested"
                      ? <button className={btnClass("secondary", "sm")} disabled={busy === r.user_id} onClick={() => toggle(r, false)}>Deactivate</button>
                      : <button className={btnClass("primary", "sm")} disabled={busy === r.user_id} onClick={() => toggle(r, true)}>Activate</button>}
                  </TD>
                </TR>);
            })}</tbody>
          </Table></TableWrap>)}
      </PageBody>
    </PortalShell>
  );
}
