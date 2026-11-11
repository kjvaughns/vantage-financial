import { describe, it, expect } from "vitest";
import { shouldAutoTranscribe } from "./media";

const drive = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view";

describe("shouldAutoTranscribe", () => {
  it("starts for a new Drive link", () => expect(shouldAutoTranscribe(drive, null)).toBe(true));
  it("skips YouTube links", () => expect(shouldAutoTranscribe("https://youtu.be/F6PHSd9JtQs", null)).toBe(false));
  it("skips when the same link is already transcribed", () =>
    expect(shouldAutoTranscribe(drive, { source_url: drive, status: "completed" })).toBe(false));
  it("restarts when the link changes", () =>
    expect(shouldAutoTranscribe("https://x.com/a.mp3", { source_url: drive, status: "completed" })).toBe(true));
  it("does not loop on a failed job for the same link", () =>
    expect(shouldAutoTranscribe(drive, { source_url: drive, status: "failed" })).toBe(false));
});
