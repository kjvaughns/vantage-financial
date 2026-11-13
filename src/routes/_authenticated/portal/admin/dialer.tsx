import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageHeader, PageBody, TableWrap, Table, THead, TH, TR, TD, Badge, EmptyState, ErrorState, TableSkeleton, btnClass } from "@/components/portal/ui";
import { listDialerRequests } from "@/lib/dialer/dialer.functions";
import { DIALER_SHEET_URL } from "@/lib/dialer/shared";

export const Route = createFileRoute("/_authenticated/portal/admin/dialer")({
  head: () => ({ meta: [{ title: "Dialer Requests — Vantage Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminDialer,
});

function AdminDialer() {
  const fn = useServerFn(listDialerRequests);
  const q = useQuery({ queryKey: ["dialer", "admin"], queryFn: () => fn() });
  return (
    <PortalShell>
      <PageHeader title="Dialer Requests" description="Every agent's dialer request. Logins are filled in on the Google Sheet."
        actions={<a href={DIALER_SHEET_URL} target="_blank" rel="noreferrer" className={btnClass("primary")}>Open sheet</a>} />
      <PageBody>
        {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState title="Couldn't load requests" description={(q.error as Error).message} /> :
          !q.data?.length ? <EmptyState title="No dialer requests yet" /> : (
          <TableWrap><Table>
            <THead><tr><TH>Agent</TH><TH>Lead types</TH><TH>States</TH><TH>Status</TH><TH>Last change</TH></tr></THead>
            <tbody>{q.data.map((r) => (
              <TR key={r.id}>
                <TD>{r.agent_name}</TD><TD>{r.lead_types.join(", ")}</TD><TD>{r.states.join(", ")}</TD>
                <TD>{r.dialer_username ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Requested</Badge>}</TD>
                <TD>{new Date(r.changed_at).toLocaleDateString()}</TD>
              </TR>))}</tbody>
          </Table></TableWrap>)}
      </PageBody>
    </PortalShell>
  );
}
