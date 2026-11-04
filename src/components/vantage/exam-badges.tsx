import { Badge } from "@/components/portal/ui";
import { examIsThisWeek } from "@/lib/applicant-exam";

export function ExamBadges({ applicant: a }: { applicant: { exam_date?: string | null; exam_format?: string | null; exam_provider?: string | null; exam_result?: string | null; resident_state?: string | null; npn?: string | null } }) {
  return <div className="mt-2 flex flex-wrap gap-1">
    {a.exam_date && <Badge tone={examIsThisWeek(a.exam_date) ? "gold" : "amber"}>Exam {examIsThisWeek(a.exam_date) ? "this week · " : ""}{new Date(a.exam_date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</Badge>}
    {a.exam_format && <Badge>{a.exam_format === "online" ? "Online" : "In person"}</Badge>}
    {a.exam_provider && <Badge>{a.exam_provider}</Badge>}
    {(a.exam_result || a.exam_date) && <Badge tone={a.exam_result === "passed" ? "green" : a.exam_result === "failed" ? "red" : "amber"}>{a.exam_result === "passed" ? "Exam passed" : a.exam_result === "failed" ? "Exam failed" : "Result pending"}</Badge>}
    {a.resident_state && <Badge>{a.resident_state}</Badge>}
    {a.npn && <Badge>NPN {a.npn}</Badge>}
  </div>;
}