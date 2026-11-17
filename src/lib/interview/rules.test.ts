import { describe, expect, it } from "vitest";
import { canManageCalendar, matchesCalendar, bookingPayload } from "./rules";
describe("team interview calendar rules", () => {
  it("allows leaders and managers to manage their own connections", () => {
    expect(canManageCalendar("leader", ["leader"], "leader")).toBe(true);
    expect(canManageCalendar("manager", ["manager"], "manager")).toBe(true);
    expect(canManageCalendar("agent", ["agent"], "agent")).toBe(false);
  });
  it("only super admins can edit another leader connection", () => {
    expect(canManageCalendar("owner", ["super_admin"], "leader")).toBe(true);
    expect(canManageCalendar("owner", ["admin"], "leader")).toBe(false);
    expect(canManageCalendar("a", ["leader"], "b")).toBe(false);
  });
  it("rejects slots displayed for a different calendar", () => {
    expect(matchesCalendar("pranav", "kj")).toBe(false);
    expect(matchesCalendar(null, "pranav")).toBe(false);
    expect(matchesCalendar("pranav", "pranav")).toBe(true);
    expect(matchesCalendar(null, null)).toBe(true);
  });
  it("books a leader owned event without the company event required fields", () => {
    const result = bookingPayload({ startIso: "2026-11-19T18:00:00Z", name: "Applicant", email: "applicant@example.com", licensed: true }, { username: "leader", eventSlug: "interview", eventTypeId: 42, timezone: "America/New_York", custom: true });
    expect("eventTypeId" in result ? result.eventTypeId : undefined).toBe(42);
    expect(result.attendee.timeZone).toBe("America/New_York");
    expect(result.bookingFieldsResponses).not.toHaveProperty("Recruit-Status");
  });
  it("preserves required company booking questions on primary fallback", () => {
    expect(bookingPayload({ startIso: "2026-11-19T18:00:00Z", name: "Applicant", email: "applicant@example.com", licensed: false }, { username: "kjvaughns", eventSlug: "15min", timezone: "America/Chicago", custom: false }).bookingFieldsResponses["Recruit-Status"]).toBe("Unlicensed");
  });
});
