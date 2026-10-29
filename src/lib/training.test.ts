import { describe, expect, it } from "vitest";
import { computeTrack, type TrainingDay } from "./training.functions";

const day = (id: string, position: number, is_release = false) =>
  ({ id, slug: id, title: id, day_label: id, position, video_url: null, objective: null, prompt: null, instructions: null, checklist: [], is_release, is_published: true }) as TrainingDay;
const days = [day("mon", 1), day("tue", 2), day("wed", 3), day("thu", 4), day("rel", 5, true)];

describe("release track unlocking", () => {
  it("keeps every day locked until training is unlocked", () => {
    expect(computeTrack(days, [], [], false).map((e) => e.state)).toEqual(["locked", "locked", "locked", "locked", "locked"]);
  });
  it("opens only Monday once training is unlocked", () => {
    expect(computeTrack(days, [], [], true).map((e) => e.state)).toEqual(["open", "open", "open", "open", "open"]);
  });
  it("opens the next day only after the previous is approved", () => {
    const p = [{ day_id: "mon", approved_at: "2026-01-01" }];
    expect(computeTrack(days, p, [], true).map((e) => e.state).slice(0, 3)).toEqual(["approved", "open", "open"]);
  });
  it("opens the release call anytime once training unlocks, with every day open", () => {
    const e = computeTrack(days, [{ day_id: "rel", approved_at: null }], [], true);
    expect(e[4].state).toBe("open");
    expect(e[1].state).toBe("open");
  });
});
