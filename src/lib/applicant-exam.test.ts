import { describe, expect, it } from "vitest";
import { applicantExamSchema, examIsThisWeek } from "./applicant-exam";
const id = "00000000-0000-4000-8000-000000000001";
describe("applicant exam details", () => {
  it("accepts online and in_person only", () => {
    for (const exam_format of ["online", "in_person"]) expect(applicantExamSchema.parse({ applicant_id: id, exam_format }).exam_format).toBe(exam_format);
    expect(applicantExamSchema.safeParse({ applicant_id: id, exam_format: "remote" }).success).toBe(false);
  });
  it("accepts pending, passed and failed results only", () => {
    for (const exam_result of ["pending", "passed", "failed"]) expect(applicantExamSchema.parse({ applicant_id: id, exam_result }).exam_result).toBe(exam_result);
    expect(applicantExamSchema.safeParse({ applicant_id: id, exam_result: "unknown" }).success).toBe(false);
  });
  it("requires an actual timestamp for an exam date", () => {
    expect(applicantExamSchema.safeParse({ applicant_id: id, exam_date: "not a date" }).success).toBe(false);
    expect(applicantExamSchema.parse({ applicant_id: id, exam_date: "2026-11-04T13:00:00Z" }).exam_date).toBe("2026-11-04T13:00:00Z");
  });
  it("highlights scheduled tests within the current calendar week", () => {
    const now = new Date(2026, 10, 4, 12);
    expect(examIsThisWeek(new Date(2026, 10, 6, 10).toISOString(), now)).toBe(true);
    expect(examIsThisWeek(new Date(2026, 10, 9, 10).toISOString(), now)).toBe(false);
    expect(examIsThisWeek(null, now)).toBe(false);
  });
});