import { BackLink } from "@/components/portal/back-link";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { PortalShell } from "@/components/vantage/portal-shell";
import { Badge, EmptyState, PageBody, PageHeader, Panel, TableWrap, Table, THead, TH, TR, TD, TextSkeleton } from "@/components/portal/ui";
import { StatusBadge } from "@/components/vantage/coach";
import { PILLARS, scoreTone } from "@/lib/coach-scoring";
import { listTeamCoaching } from "@/lib/coach.functions";

export const Route = createFileRoute("/_authenticated/portal/coach/team")({
  head: () => ({
    meta: [
      { title: "Team Coaching — Vantage Call Coach" },
      { name: "description", content: "See your downline's call scores and weakest pillars." },
      { property: "og:title", content: "Team Coaching — Vantage Call Coach" },
      { property: "og:description", content: "Downline call scores and coaching." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const fn = useServerFn(listTeamCoaching);
  const q = useQuery({ queryKey: ["coach-team"], queryFn: () => fn() });
  return (
    <PortalShell>
      <PageBody>
        <BackLink to="/portal/training" search={{ tab: "coach" }} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft size={14} aria-hidden /> Call Coach</BackLink>
        <PageHeader title="Team Coaching" description="Every call your downline submits, with averages and the pillar each agent needs most help on." />
        <Panel padded={false}>
          {q.isLoading ? <div className="p-4"><TextSkeleton lines={5} /></div> : !q.data?.agents.length ? (
            <EmptyState title="No team calls yet" description="When agents in your downline submit calls, they'll show up here." />
          ) : (
            <TableWrap>
              <Table>
                <THead><TR><TH>Agent</TH><TH>Calls</TH><TH>Avg score</TH><TH>Weakest pillar</TH><TH>Latest call</TH></TR></THead>
                <tbody>
                  {q.data.agents.map((a: any) => (
                    <TR key={a.profile_id}>
                      <TD className="font-medium">{a.name}</TD>
                      <TD>{a.calls}</TD>
                      <TD>{a.avg == null ? "—" : <Badge tone={scoreTone(a.avg, 100)}>{a.avg}</Badge>}</TD>
                      <TD>{a.weakest ? PILLARS.find((p) => p.key === a.weakest)?.label : "—"}</TD>
                      <TD>
                        {a.latest && (
                          <Link to="/portal/coach/$id" params={{ id: a.latest.id }} className="inline-flex items-center gap-2 text-primary underline">
                            {a.latest.title} <StatusBadge status={a.latest.status} />
                          </Link>
                        )}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Panel>
      </PageBody>
    </PortalShell>
  );
}
