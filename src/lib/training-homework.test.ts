import { describe, expect, it } from "vitest";
import { isGoogleDriveRecordingLink, validateHomeworkRecording } from "./training-homework";

describe("daily recording homework", () => {
  it("accepts Google Drive recording file shares", () => {
    expect(isGoogleDriveRecordingLink("https://drive.google.com/file/d/recording_123/view?usp=sharing")).toBe(true);
    expect(isGoogleDriveRecordingLink("https://drive.google.com/open?id=recording_123")).toBe(true);
    expect(() => validateHomeworkRecording(false, "https://drive.google.com/file/d/recording_123/view")).not.toThrow();
  });
  it("requires a recording link for daily homework", () => {
    expect(() => validateHomeworkRecording(false, null)).toThrow();
    expect(() => validateHomeworkRecording(false, "https://chatgpt.com/share/123")).toThrow();
  });
  it("rejects direct recording uploads", () => {
    expect(() => validateHomeworkRecording(false, null, "agent/recording.m4a")).toThrow();
  });
  it("rejects Drive folders and lookalike links", () => {
    for (const link of ["https://drive.google.com/drive/folders/123", "https://drive.google.com.evil.test/file/d/123/view", "http://drive.google.com/file/d/123/view"]) {
      expect(isGoogleDriveRecordingLink(link)).toBe(false);
    }
  });
  it("keeps release call requests free of homework requirements", () => {
    expect(() => validateHomeworkRecording(true, null)).not.toThrow();
  });
});