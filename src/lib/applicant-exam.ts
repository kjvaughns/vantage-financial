import { z } from "zod";

export const examFields = {
  exam_date: z.string().datetime({ offset: true }).nullable().optional(),
  exam_format: z.enum(["online", "in_person"]).nullable().optional(),
  exam_provider: z.string().trim().max(120).nullable().optional(),
  exam_result: z.enum(["pending", "passed", "failed"]).nullable().optional(),
  npn: z.string().trim().max(40).nullable().optional(),
  resident_state: z.string().trim().max(60).nullable().optional(),
};

export const applicantExamSchema = z.object({
  applicant_id: z.string().uuid(), ...examFields,
  notes: z.string().trim().max(1000).nullable().optional(),
});

export function examIsThisWeek(date: string | null | undefined, now = new Date()) {
  if (!date) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const exam = new Date(date).getTime();
  return exam >= start.getTime() && exam < end.getTime();
}