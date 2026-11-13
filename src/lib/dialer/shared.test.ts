import { describe, expect, it } from "vitest";
import { normalizeLeadTypes, normalizeStates, toSheetList, fromSheetList, previousCentralDay } from "./shared";

describe("dialer formatting", () => {
  it("keeps only FEX, VETS, MP in sheet order", () => {
    expect(toSheetList(normalizeLeadTypes(["mp", "FEX", "bogus"]))).toBe("FEX, MP");
  });
  it("normalizes state abbreviations", () => {
    expect(normalizeStates(["tx", "AL", "ZZ"])).toEqual(["AL", "TX"]);
    expect(fromSheetList("TX, AL")).toEqual(["TX", "AL"]);
  });
});

describe("digest window", () => {
  it("covers the previous Central day (CST)", () => {
    const w = previousCentralDay(new Date("2026-11-13T14:00:00Z")); // 8 AM CST Nov 13
    expect(w.label).toBe("2026-11-12");
    expect(w.start.toISOString()).toBe("2026-11-12T06:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-11-13T06:00:00.000Z");
  });
  it("covers the previous Central day (CDT)", () => {
    const w = previousCentralDay(new Date("2026-07-02T13:00:00Z"));
    expect(w.start.toISOString()).toBe("2026-07-01T05:00:00.000Z");
  });
});
