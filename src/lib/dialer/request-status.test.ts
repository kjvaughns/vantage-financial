import { describe, expect, it } from "vitest";
import { normalizeRequestStatus } from "./shared";
describe("sheet request status", () => {
  it("Request means requested", () => expect(normalizeRequestStatus("Request")).toBe("requested"));
  it("In Progress", () => expect(normalizeRequestStatus("In Progress")).toBe("in_progress"));
  it("Done", () => expect(normalizeRequestStatus("Done")).toBe("done"));
  it("blank is no request", () => expect(normalizeRequestStatus("")).toBeNull());
});
