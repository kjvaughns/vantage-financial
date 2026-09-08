import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPossibleDuplicates } from "@/lib/portal.functions";
import { Panel, Button } from "@/components/portal/ui";
import { formatPhone } from "@/lib/phone";

/** Applicants sharing an email address or phone number, for manual review. */
export function PossibleDuplicatesPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const fn = useServerFn(listPossibleDuplicates);
  const q = useQuery({ queryKey: ["possible-duplicates"], queryFn: () => fn() });
  const groups = q.data ?? [];
  if (q.isLoading || q.isError || groups.length === 0) return null;

  return (
    <Panel className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px]">
          <strong>{groups.length}</strong> possible duplicate{groups.length === 1 ? "" : " sets"} —
          applicants sharing an email address or phone number.
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide" : "Review"}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 grid gap-3">
          {groups.map((g) => (
            <div
              key={g.key}
              className="rounded-[10px] border p-3"
              style={{ borderColor: "var(--p-border)" }}
            >
              <div className="mb-2 text-[12px] uppercase tracking-wide opacity-60">
                {g.match_kind === "email" ? "Same email" : "Same phone"} · {g.group_key}
              </div>
              <div className="grid gap-2">
                {g.members.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                    <div>
                      <strong>
                        {[m.first_name, m.last_name].filter(Boolean).join(" ") || m.email}
                      </strong>
                      <span className="opacity-70">
                        {" — "}
                        {m.stage_name ?? "no stage"}
                        {m.recruiter_name ? ` · ${m.recruiter_name}` : ""}
                        {m.phone ? ` · ${formatPhone(m.phone)}` : ""}
                        {" · added "}
                        {new Date(m.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onOpen(m.id)}>
                      Open
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
