/** Accept recording-file shares, not Drive folders or lookalike hosts. */
export function isGoogleDriveRecordingLink(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com" || url.username || url.password || url.port) return false;
    return /^\/file\/d\/[A-Za-z0-9_-]+(?:\/(?:view|preview))?\/?$/.test(url.pathname) ||
      (["/open", "/uc"].includes(url.pathname) && /^[A-Za-z0-9_-]+$/.test(url.searchParams.get("id") ?? ""));
  } catch {
    return false;
  }
}

export function validateHomeworkRecording(isRelease: boolean, link: string | null | undefined, filePath?: string | null): void {
  if (isRelease) return;
  if (filePath || !link || !isGoogleDriveRecordingLink(link)) {
    throw new Error("Paste a Google Drive shareable link to your recording. Direct uploads and ChatGPT share links are not accepted.");
  }
}