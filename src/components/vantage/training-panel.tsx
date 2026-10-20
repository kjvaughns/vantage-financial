import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge, Button, EmptyState, Panel, TextSkeleton, notify, type BadgeTone } from "@/components/portal/ui";
import { getApplicantTraining, overrideTraining, type DayState } from "@/lib/training.functions";
import { NewContentBadge } from "@/components/vantage/new-content-badge";

export const STATE_LABEL: Record<DayState, string> = {
  locked: "Locked",
  open: "Ready",
  submitted: "Waiting on review",
  redo: "Needs another rep",
  approved: "Approved",
};
export const STATE_TONE: Record<DayState, BadgeTone> = {
  locked: "neutral",
  open: "gold",
  submitted: "blue",
  redo: "amber",
  approved: "green",
};

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—");

/** Training section on the applicant/agent record: status, submissions and manual overrides. */
export function ApplicantTrainingPanel({ applicantId }: { applicantId: string }) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getApplicantTraining);
  const overrideFn = useServerFn(overrideTraining);
  const q = useQuery({ queryKey: ["applicant-training", applicantId], queryFn: () => fetchFn({ data: { applicantId } }) });
  const m = useMutation({
    mutationFn: (v: { action: "unlock" | "lock" | "approve_day" | "unapprove_day" | "pass_release"; dayId?: string }) =>
      overrideFn({ data: { applicantId, ...v } }),
    onSuccess: () => {
      notify.success("Training updated");
      qc.invalidateQueries({ queryKey: ["applicant-training", applicantId] });
      qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
    },
    onError: (e: Error) => notify.error("Couldn't update training", e.message),
  });

  if (q.isLoading) return <Panel><TextSkeleton lines={4} /></Panel>;
  if (q.error) return <Panel><EmptyState title="Couldn't load training" description={(q.error as Error).message} /></Panel>;
  const d = q.data!;
  if (!d.hasAccount)
    return (
      <Panel>
        <EmptyState title="No portal account yet" description="Training starts once this person creates their account and finishes onboarding." />
      </Panel>
    );
  const a = d.applicant as any;

  return (
    <div className="space-y-4">
      <Panel
        title="Training status"
        actions={
          a.unlocked && !a.onboarding_completed_at ? (
            a.training_unlocked_at ? (
              <Button size="sm" variant="ghost" loading={m.isPending} onClick={() => m.mutate({ action: "lock" })}>Remove manual unlock</Button>
            ) : null
          ) : !a.unlocked ? (
            <Button size="sm" variant="primary" loading={m.isPending} onClick={() => m.mutate({ action: "unlock" })}>Unlock training now</Button>
          ) : null
        }
      >
        <div className="grid gap-3 text-[13.5px] sm:grid-cols-3">
          <div><div className="p-label mb-1">Access</div>{a.unlocked ? (a.onboarding_completed_at ? "Unlocked (onboarding done)" : "Unlocked manually") : "Locked until onboarding is done"}</div>
          <div><div className="p-label mb-1">Release requested</div>{fmt(a.release_requested_at)}</div>
          <div><div className="p-label mb-1">Cleared to call</div>{a.cleared_to_call_at ? <Badge tone="green">{fmt(a.cleared_to_call_at)}</Badge> : "Not yet"}</div>
        </div>
      </Panel>

      {d.track.map(({ day, state }) => {
        const subs = d.submissions.filter((s) => s.day_id === day.id);
        return (
          <Panel
            key={day.id}
            title={<span>{day.day_label ? `${day.day_label} · ` : ""}{day.title}</span>}
            actions={
              <div className="flex items-center gap-2">
                <NewContentBadge createdAt={day.created_at} />
                <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>
                {state === "approved" ? (
                  <Button size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate({ action: "unapprove_day", dayId: day.id })}>Undo</Button>
                ) : day.is_release ? (
                  <Button size="sm" variant="primary" disabled={m.isPending} onClick={() => confirm("Mark release call passed and clear this agent to call?") && m.mutate({ action: "pass_release" })}>Mark release passed</Button>
                ) : (
                  <Button size="sm" variant="secondary" disabled={m.isPending} onClick={() => m.mutate({ action: "approve_day", dayId: day.id })}>Approve day</Button>
                )}
              </div>
            }
          >
            {subs.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No submissions yet.</p>
            ) : (
              <ul className="space-y-3">
                {subs.map((s) => (
                  <li key={s.id} className="rounded-md border border-border p-3 text-[13px]">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge tone={s.status === "approved" ? "green" : s.status === "redo" ? "amber" : "blue"}>{s.status === "submitted" ? "Waiting" : s.status === "redo" ? "Sent back" : "Approved"}</Badge>
                      <span className="text-muted-foreground">{fmt(s.created_at)}</span>
                    </div>
                    {s.file_url && <video src={s.file_url} controls className="mt-2 w-full max-w-lg rounded" />}
                    {s.link_url && <a href={s.link_url} target="_blank" rel="noreferrer" className="text-primary underline">Open homework recording / link</a>}
                    {s.note && <p className="mt-1">{s.note}</p>}
                    {s.feedback && <p className="mt-1 text-muted-foreground">Feedback: {s.feedback}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
