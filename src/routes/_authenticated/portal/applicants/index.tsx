import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ChevronRight, Plus } from "lucide-react";
import { PortalShell } from "@/components/vantage/portal-shell";
import { ApplicantRecord } from "@/components/vantage/applicant-record";
import { listApplicants, updateApplicantStage } from "@/lib/portal.functions";
import { AddApplicantModal } from "@/components/vantage/add-applicant-modal";
import { RecruitingLinkCard } from "@/components/vantage/recruiting-link-card";
import { onboardingProgress } from "@/lib/onboarding";
import { formatPhone } from "@/lib/phone";
import { instagramLabel, instagramUrl } from "@/lib/instagram";

/** Stages at or past Onboarding mean the recruit is licensed. */
const LICENSED_STAGE_SLUGS = new Set(["onboarding", "training", "active-agent"]);
import {
  PageHeader,
  PageBody,
  Panel,
  Button,
  IconButton,
  Toolbar,
  ToolbarSpacer,
  SegmentedControl,
  Badge,
  TableWrap,
  Table,
  THead,
  TH,
  TR,
  TD,
  EmptyState,
  ErrorState,
  SearchField,
  Select,
  Skeleton,
  TableSkeleton,
  ListSkeleton,
  notify,
} from "@/components/portal/ui";

const searchSchema = z.object({
  tab: z.enum(["list", "pipeline"]).optional(),
  open: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/portal/applicants/")({
  head: () => ({
    meta: [{ title: "Applicants — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: ApplicantsPage,
});

type Scope = "mine" | "direct" | "downline" | "all";
const SCOPE_LABELS: Record<Scope, string> = {
  mine: "Mine",
  direct: "Direct",
  downline: "Downline",
  all: "All",
};
type View = "all" | "pre_licensing";

function ApplicantsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { tab, open } = Route.useSearch();
  const activeTab: "list" | "pipeline" = tab === "pipeline" ? "pipeline" : "list";

  // Applicant record opens in a side drawer (deep-linkable via ?open=<id>).
  const [openId, setOpenId] = useState<string | null>(open ?? null);
  useEffect(() => {
    setOpenId(open ?? null);
  }, [open]);
  const closeDrawer = () => {
    setOpenId(null);
    if (open) navigate({ to: "/portal/applicants", search: { tab } });
  };

  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("mine");
  const [stage, setStage] = useState("");
  const [view, setView] = useState<View>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addStageId, setAddStageId] = useState<string | null>(null);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? (localStorage.getItem("vantage_crm_scope") as Scope | null) : null;
    if (saved && ["mine", "direct", "downline", "all"].includes(saved)) setScope(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("vantage_crm_scope", scope);
  }, [scope]);

  const fn = useServerFn(listApplicants);
  const changeStage = useServerFn(updateApplicantStage);

  // Shared query drives both tabs. The List tab additionally applies q/stage/view.
  const applicantsQ = useQuery({
    queryKey: ["applicants", { q, scope, stage, view, tab: activeTab }],
    queryFn: () =>
      fn({
        data:
          activeTab === "pipeline"
            ? { scope, limit: 200, q: "", stage: "", view: "all" }
            : { q, scope, stage, view, limit: 200 },
      }),
  });
  const { data, isLoading } = applicantsQ;

  const stages = data?.stages ?? [];
  const stageMap = useMemo(() => {
    const m: Record<string, { name: string; color: string; slug?: string }> = {};
    for (const s of stages) m[s.id] = { name: s.name, color: s.color, slug: (s as any).slug };
    return m;
  }, [stages]);
  const onboardingStageIds = useMemo(
    () => new Set(stages.filter((s: any) => s.slug === "onboarding").map((s: any) => s.id)),
    [stages],
  );

  function nextStageOf(currentId: string | null) {
    if (!currentId) return null;
    const i = stages.findIndex((s) => s.id === currentId);
    if (i < 0 || i >= stages.length - 1) return null;
    return stages[i + 1];
  }
  async function moveNext(applicantId: string, currentId: string | null) {
    const next = nextStageOf(currentId);
    if (!next) return;
    await changeStage({ data: { id: applicantId, stage_id: next.id } });
    qc.invalidateQueries({ queryKey: ["applicants"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  async function moveToStage(applicantId: string, stageId: string) {
    if (!stageId) return;
    await changeStage({ data: { id: applicantId, stage_id: stageId } });
    qc.invalidateQueries({ queryKey: ["applicants"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  function setTab(t: "list" | "pipeline") {
    navigate({ to: "/portal/applicants", search: t === "pipeline" ? { tab: "pipeline" } : {} });
  }

  const applicants = data?.applicants ?? [];

  return (
    <PortalShell>
      <PageBody>
        <PageHeader
          title="Applicants"
          description="Every recruit you're working, from first application through licensing."
          actions={
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
              <Plus size={14} aria-hidden /> Add Applicant
            </Button>
          }
        />

        <div className="mb-4">
          <RecruitingLinkCard variant="compact" />
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl
            size="sm"
            value={activeTab}
            onChange={(t) => setTab(t)}
            options={[
              { value: "list", label: "List" },
              { value: "pipeline", label: "Pipeline" },
            ]}
          />
          <SegmentedControl
            size="sm"
            value={scope}
            onChange={(s) => setScope(s)}
            options={(["mine", "direct", "downline", "all"] as const).map((s) => ({
              value: s,
              label: SCOPE_LABELS[s],
            }))}
          />
        </div>

        {applicantsQ.isError ? (
          <Panel>
            <ErrorState
              title="Couldn't load applicants"
              description="Your pipeline didn't load. Check your connection and try again."
              onRetry={() => applicantsQ.refetch()}
            />
          </Panel>
        ) : activeTab === "list" ? (
          <>
            <PossibleDuplicatesPanel onOpen={setOpenId} />

          <ListView
            data={data}
            isLoading={isLoading}
            q={q}
            setQ={setQ}
            stage={stage}
            setStage={setStage}
            view={view}
            setView={setView}
            setScope={setScope}
            stageMap={stageMap}
            onboardingStageIds={onboardingStageIds}
            nextStageOf={nextStageOf}
            moveNext={moveNext}
            moveToStage={moveToStage}
            onOpen={setOpenId}
            onAdd={() => setAddOpen(true)}
          />
          </>

        ) : (
          <PipelineView
            stages={stages}
            applicants={applicants}
            isLoading={isLoading}
            onOpen={setOpenId}
            onAdd={(stageId) => {
              setAddStageId(stageId);
              setAddOpen(true);
            }}
          />
        )}
      </PageBody>

      {openId && <ApplicantRecord applicantId={openId} variant="drawer" onClose={closeDrawer} />}

      {addOpen && (
        <AddApplicantModal
          defaultStageId={addStageId ?? undefined}
          onClose={() => {
            setAddOpen(false);
            setAddStageId(null);
          }}
          onCreated={(id) => {
            setAddOpen(false);
            setAddStageId(null);
            qc.invalidateQueries({ queryKey: ["applicants"] });
            setOpenId(id);
          }}
        />
      )}
    </PortalShell>
  );
}

function ListView({
  data,
  isLoading,
  q,
  setQ,
  stage,
  setStage,
  view,
  setView,
  setScope,
  stageMap,
  onboardingStageIds,
  nextStageOf,
  moveNext,
  moveToStage,
  onOpen,
  onAdd,
}: any) {
  const emptyState =
    view === "pre_licensing" ? (
      <EmptyState
        title="No pre-licensing follow-ups"
        description="Applicants who are hired but not yet licensed show up here so nobody stalls out. Nothing is waiting on you right now."
      />
    ) : (
      <EmptyState
        title="No applicants match these filters"
        description="Applicants arrive from your recruiting link, or you can add one by hand. Widen the scope to see the whole organization."
        action={
          <>
            <Button size="sm" variant="secondary" onClick={() => setScope("all")}>
              View all scopes
            </Button>
            <Button size="sm" variant="primary" onClick={onAdd}>
              <Plus size={14} aria-hidden /> Add Applicant
            </Button>
          </>
        }
      />
    );

  return (
    <>
      <Toolbar className="mb-3">
        <SearchField value={q} onChange={setQ} placeholder="Search by name, email, or phone…" />
        {view === "all" && (
          <Select
            className="w-auto max-w-[200px]"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="">All stages</option>
            {(data?.stages ?? []).map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <ToolbarSpacer />
        <SegmentedControl
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "all", label: "All applicants" },
            { value: "pre_licensing", label: "Pre-Licensing" },
          ]}
        />
      </Toolbar>

      {view === "pre_licensing" && (
        <p className="p-muted mb-3">
          Hired but not yet licensed, sorted by longest since last follow-up — the most overdue
          check-ins are at the top.
        </p>
      )}

      {/* Mobile: stacked cards (the 6-column table is too wide for phones). */}
      <div className="flex flex-col gap-2.5 sm:hidden">
        {isLoading ? (
          <div className="p-panel p-4">
            <ListSkeleton rows={4} />
          </div>
        ) : (data?.applicants ?? []).length === 0 ? (
          <div className="p-panel">{emptyState}</div>
        ) : (
          (data?.applicants ?? []).map((a: any) => {
            const s = a.current_stage_id ? stageMap[a.current_stage_id] : null;
            const next = nextStageOf(a.current_stage_id);
            const licensed = !!a.licensed || LICENSED_STAGE_SLUGS.has(s?.slug ?? "");
            return (
              <div key={a.id} className="p-panel p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => onOpen(a.id)} className="min-w-0 text-left">
                    <div className="p-body font-semibold truncate">
                      {a.first_name} {a.last_name}
                    </div>
                    <div className="p-muted truncate">
                      {a.city || "—"}
                      {a.state ? `, ${a.state}` : ""}
                    </div>
                  </button>
                  {s ? <StageChip stage={s} /> : null}
                </div>

                <div className="p-muted mt-2 truncate text-[12.5px]">
                  {a.email}
                  {a.phone ? ` · ${formatPhone(a.phone)}` : ""}
                  {instagramLabel(a.instagram_handle)
                    ? ` · ${instagramLabel(a.instagram_handle)}`
                    : ""}
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {a.current_stage_id && onboardingStageIds.has(a.current_stage_id)
                    ? (() => {
                        const p = onboardingProgress(a.onboarding_steps);
                        return (
                          <Badge tone={p.done === p.total ? "green" : "amber"}>
                            Onboarding {p.done}/{p.total}
                          </Badge>
                        );
                      })()
                    : null}
                  <Badge tone={licensed ? "green" : "amber"}>{licensed ? "Licensed" : "Unlicensed"}</Badge>
                  {a.hired_at && <Badge tone="green">Hired</Badge>}
                  {!a.hired_at && a.evaluation_completed_at && <Badge>Evaluated</Badge>}
                  {a.calendly_scheduled_at && <Badge>Scheduled</Badge>}
                  {a.discord_confirmed && <Badge tone="green" dot>Discord</Badge>}
                </div>

                {view === "pre_licensing" &&
                  (() => {
                    const days = a.last_follow_up_at ? daysSince(a.last_follow_up_at) : null;
                    const overdue = days === null || days > 7;
                    return (
                      <div className="mt-2">
                        <Badge tone={overdue ? "red" : "green"}>
                          {days === null ? "No follow-up yet" : `${days}d since follow-up`}
                        </Badge>
                      </div>
                    );
                  })()}

                <div
                  className="mt-3 flex items-center gap-2 border-t pt-3"
                  style={{ borderColor: "var(--p-border)" }}
                >
                  <span className="p-muted flex-1 truncate text-[12px]">
                    Applied {shortDate(a.created_at)} · Active {relative(a.updated_at)}
                  </span>
                  {next && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-11"
                      onClick={() => moveNext(a.id, a.current_stage_id)}
                    >
                      {next.name} <ChevronRight size={14} aria-hidden />
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" className="min-h-11" onClick={() => onOpen(a.id)}>
                    Open
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <TableWrap className="hidden sm:block">
        <Table>
          <THead>
            <TH>Applicant</TH>
            <TH>Contact</TH>
            <TH>Stage</TH>
            <TH>Statuses</TH>
            <TH>Dates</TH>
            <TH align="right">Actions</TH>
          </THead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TR key={i}>
                  {Array.from({ length: 6 }).map((__, c) => (
                    <TD key={c}>
                      <Skeleton className="h-3" style={{ maxWidth: c === 0 ? 160 : 110 }} />
                    </TD>
                  ))}
                </TR>
              ))
            ) : (data?.applicants ?? []).length === 0 ? (
              <TR>
                <TD colSpan={6}>{emptyState}</TD>
              </TR>
            ) : (
              (data?.applicants ?? []).map((a: any) => {
                const next = nextStageOf(a.current_stage_id);
                const licensed =
                  !!a.licensed ||
                  LICENSED_STAGE_SLUGS.has(
                    (a.current_stage_id ? stageMap[a.current_stage_id]?.slug : "") ?? "",
                  );
                return (
                  <TR key={a.id}>
                    <TD>
                      <button onClick={() => onOpen(a.id)} className="block min-w-0 text-left">
                        <div className="p-body font-semibold truncate hover:opacity-80">
                          {a.first_name} {a.last_name}
                        </div>
                        <div className="p-muted truncate">
                          {a.city || "—"}
                          {a.state ? `, ${a.state}` : ""}
                          {a.referring_recruiter_name ? ` · ref: ${a.referring_recruiter_name}` : ""}
                        </div>
                      </button>
                    </TD>
                    <TD>
                      <div className="p-body truncate max-w-[200px]">{a.email}</div>
                      <div className="p-muted">{formatPhone(a.phone) || "—"}</div>
                      {instagramUrl(a.instagram_handle) ? (
                        <a
                          href={instagramUrl(a.instagram_handle)}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={(e) => e.stopPropagation()}
                          className="p-muted truncate text-[var(--p-gold)] hover:underline"
                        >
                          {instagramLabel(a.instagram_handle)}
                        </a>
                      ) : null}
                    </TD>
                    <TD>
                      {/* Inline stage change — no need to open the record. */}
                      <Select
                        aria-label={`Stage for ${a.first_name} ${a.last_name}`}
                        value={a.current_stage_id ?? ""}
                        onChange={(e) => moveToStage(a.id, e.target.value)}
                        className="h-8 w-auto max-w-[180px] py-0 text-[12.5px]"
                      >
                        {!a.current_stage_id && <option value="">—</option>}
                        {(data?.stages ?? []).map((st: any) => (
                          <option key={st.id} value={st.id}>
                            {st.name}
                          </option>
                        ))}
                      </Select>
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {a.current_stage_id && onboardingStageIds.has(a.current_stage_id)
                          ? (() => {
                              const p = onboardingProgress(a.onboarding_steps);
                              return (
                                <Badge tone={p.done === p.total ? "green" : "amber"}>
                                  Onboarding {p.done}/{p.total}
                                </Badge>
                              );
                            })()
                          : null}
                        <Badge tone={licensed ? "green" : "amber"}>
                          {licensed ? "Licensed" : "Unlicensed"}
                        </Badge>
                        {a.hired_at && <Badge tone="green">Hired</Badge>}
                        {!a.hired_at && a.evaluation_completed_at && <Badge>Evaluated</Badge>}
                        {a.calendly_scheduled_at && <Badge>Scheduled</Badge>}
                        {a.discord_confirmed && <Badge tone="green" dot>Discord</Badge>}
                      </div>
                    </TD>
                    <TD>
                      <div className="p-muted">
                        <div>Applied {shortDate(a.created_at)}</div>
                        <div>Active {relative(a.updated_at)}</div>
                        {view === "pre_licensing" &&
                          (() => {
                            const days = a.last_follow_up_at ? daysSince(a.last_follow_up_at) : null;
                            const overdue = days === null || days > 7;
                            return (
                              <div className="mt-0.5">
                                <Badge tone={overdue ? "red" : "green"}>
                                  {days === null ? "No follow-up yet" : `${days}d since follow-up`}
                                </Badge>
                              </div>
                            );
                          })()}
                      </div>
                    </TD>
                    <TD align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        {next && (
                          <IconButton
                            size="sm"
                            label={`Move to ${next.name}`}
                            onClick={() => moveNext(a.id, a.current_stage_id)}
                          >
                            <ChevronRight size={15} aria-hidden />
                          </IconButton>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => onOpen(a.id)}>Open</Button>
                      </div>
                    </TD>
                  </TR>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}

function PipelineView({
  stages,
  applicants,
  isLoading,
  onAdd,
  onOpen,
}: {
  stages: any[];
  applicants: any[];
  isLoading: boolean;
  onAdd: (stageId: string | null) => void;
  onOpen: (id: string) => void;
}) {
  if (isLoading)
    return (
      <div className="p-snap-x -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-snap-item w-[82vw] min-w-[82vw] flex-1 sm:w-auto sm:min-w-[240px]">
            <div
              className="mb-2 rounded-[10px] border px-2.5 py-2.5"
              style={{ background: "var(--p-raised)", borderColor: "var(--p-border)" }}
            >
              <Skeleton className="h-2.5 w-24" />
            </div>
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 3 }).map((__, r) => (
                <div key={r} className="p-panel px-2.5 py-3">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="mt-2 h-2.5 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );

  if (stages.length === 0)
    return (
      <Panel>
        <EmptyState
          title="No pipeline stages yet"
          description="Stages define how a recruit moves from application to licensed agent. An admin can set them up under Admin → Pipeline stages."
        />
      </Panel>
    );

  return (
    <div className="p-snap-x -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {stages.map((s: any) => {
        const items = applicants.filter((a: any) => a.current_stage_id === s.id);
        return (
          <div key={s.id} className="p-snap-item w-[82vw] min-w-[82vw] flex-1 sm:w-auto sm:min-w-[240px]">
            <div
              className="mb-2 flex items-center justify-between rounded-[10px] border px-2.5 py-2"
              style={{ background: "var(--p-raised)", borderColor: "var(--p-border)" }}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: s.color || "var(--p-gold)" }}
                />
                <span className="p-label truncate">{s.name}</span>
                <span className="p-muted shrink-0">({items.length})</span>
              </div>
              <IconButton
                size="sm"
                label={`Add applicant to ${s.name}`}
                onClick={() => onAdd(s.id)}
                className="h-7 w-7"
              >
                <Plus size={14} aria-hidden />
              </IconButton>
            </div>
            <div className="flex flex-col gap-1.5">
              {items.map((a: any) => (
                <button
                  key={a.id}
                  onClick={() => onOpen(a.id)}
                  className="p-panel block w-full px-2.5 py-2 text-left transition hover:brightness-[1.08]"
                  style={{ minHeight: 72 }}
                >
                  <div className="p-body font-medium truncate">
                    {a.first_name} {a.last_name}
                  </div>
                  <div className="p-muted truncate">
                    {a.city ?? ""}
                    {a.state ? `, ${a.state}` : ""}
                  </div>
                  <div className="p-muted mt-1 truncate">{a.email}</div>
                </button>
              ))}
              <button
                onClick={() => onAdd(s.id)}
                className="p-focus flex items-center justify-center gap-1 rounded-[10px] border border-dashed py-2 text-[12.5px] transition hover:bg-[var(--p-hover)]"
                style={{ borderColor: "var(--p-border)", color: "var(--p-text-3)" }}
              >
                <Plus size={13} aria-hidden /> Add applicant
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
}
function relative(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Pipeline stage pill. Stage colors are admin-configured, so they stay inline. */
function StageChip({ stage }: { stage: { name: string; color: string } }) {
  const color = stage.color || "var(--p-gold)";
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium whitespace-nowrap"
      style={{ color, background: `color-mix(in oklab, ${color} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {stage.name}
    </span>
  );
}
