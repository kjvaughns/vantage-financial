import { describe, expect, it } from "vitest";
import { isNewContent, NEW_CONTENT_WINDOW_MS } from "./new-content";

describe("seven-day New badge", () => {
  const createdAt = "2026-10-20T22:05:00.000Z";
  const created = Date.parse(createdAt);
  it("automatically marks new content without a manual flag", () => {
    expect(isNewContent(createdAt, created)).toBe(true);
  });
  it("remains visible until seven days have elapsed", () => {
    expect(isNewContent(createdAt, created + 7 * 24 * 60 * 60 * 1000 - 1)).toBe(true);
  });
  it("expires exactly after seven days", () => {
    expect(NEW_CONTENT_WINDOW_MS).toBe(604800000);
    expect(isNewContent(createdAt, created + 604800000)).toBe(false);
  });
  it("does not mark old, missing, invalid or future timestamps", () => {
    for (const value of [null, undefined, "invalid", "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z"]) {
      expect(isNewContent(value, created)).toBe(false);
    }
  });
});