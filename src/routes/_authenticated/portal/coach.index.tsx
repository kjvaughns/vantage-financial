import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Users } from "lucide-react";
import { PortalShell } from "@/components/vantage/portal-shell";
import { EmptyState, PageBody, PageHeader, Panel, TextSkeleton, btnClass } from "@/components/portal/ui";
import { PillarBars, ScoreRing, StatusBadge, SubmitCallForm } from "@/components/vantage/coach";
import { listMyReviews } from "@/lib/coach.functions";

export const Route = createFileRoute("/_authenticated/portal/coach/")({
  head: () => ({
    meta: [
      { title: "Call Coach — Vantage Training Hub" },
      { name: "description", content: "Upload a call and get AI scores on every pillar of the Vantage script." },
      { property: "og:title", content: "Call Coach — Vantage Training Hub" },
      { property: "og:description", content: "AI call scoring against the Vantage Gold Standard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CoachPage,
});

function CoachPage() {
  const fn = useServerFn(listMyReviews);
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["coach-mine"], queryFn: () => fn(), refetchInterval: (qq) => ((qq.state.data?.reviews ?? []).some((r: any) => r.status !== "done" && r.status !== "failed") ? 8000 : false) });
  return (
    <PortalShell>
      <PageBody>
        <PageHeader
          title="Call Coach"
          description="Upload a roleplay or live call. It's scored 1–10 on all 8 pillars against the Vantage script and model calls."
          actions={<Link to="/portal/coach/team" className={btnClass("secondary", "sm")}><Users size={14} aria-hidden /> Team coaching</Link>}
        />
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Panel title="Analyze a call">
            <SubmitCallForm onCreated={(id) => navigate({ to: "/portal/coach/$id", params: { id } })} />
          </Panel>
          <Panel title="Your averages">
            {q.isLoading ? <TextSkeleton lines={6} /> : (
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <ScoreRing value={q.data?.overallAvg ?? null} label="Avg" />
                <div className="w-full flex-1"><PillarBars scores={q.data?.pillarAvg ?? {}} /></div>
              </div>
            )}
          </Panel>
        </div>
        <Panel title="Call history" className="mt-4" padded={false}>
          {q.isLoading ? <div className="p-4"><TextSkeleton lines={4} /></div> : !q.data?.reviews.length ? (
            <EmptyState title="No calls yet" description="Submit your first call above to get your scorecard." />
          ) : (
            <ul>
              {q.data.reviews.map((r: any) => (
                <li key={r.id} className="border-b border-border last:border-0">
                  <Link to="/portal/coach/$id" params={{ id: r.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                    <div className="w-12 text-center text-[18px] font-semibold tabular-nums text-primary">{r.overall ?? "—"}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{r.title}</div>
                      <div className="text-[12px] text-muted-foreground">{r.call_type === "live" ? "Live call" : "Roleplay"} · {new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                    <StatusBadge status={r.status} />
                    <ChevronRight size={16} className="text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </PageBody>
    </PortalShell>
  );
}
