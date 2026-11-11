import { resolveMedia, shouldAutoTranscribe } from "@/lib/academy/media";

/** Start transcription in the background right after an Academy item is saved.
 *  Never throws: a failure is recorded on the transcript row instead. */
export async function autoQueueTranscription(
  s: any,
  ownerType: "recording" | "library" | "lesson",
  ownerId: string,
  rawUrl: string | null | undefined,
) {
  try {
    const url = (rawUrl ?? "").trim();
    const { data: existing } = await s
      .from("media_transcripts")
      .select("source_url, status, notes")
      .eq("owner_type", ownerType)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!shouldAutoTranscribe(url, existing)) return;
    const fetchUrl = resolveMedia(url).fetchUrl!;
    const { submitTranscription } = await import("@/lib/academy/transcribe.server");
    const base = {
      owner_type: ownerType,
      owner_id: ownerId,
      source_url: url,
      resolved_url: fetchUrl,
      requested_at: new Date().toISOString(),
    };
    try {
      const jobId = await submitTranscription(fetchUrl);
      await s.from("media_transcripts").upsert(
        {
          ...base,
          status: "queued",
          provider_job_id: jobId,
          error: null,
          transcript_text: null,
          transcript_segments: null,
          notes: existing?.notes ?? null,
          notes_status: "not_started",
          notes_error: null,
          completed_at: null,
        },
        { onConflict: "owner_type,owner_id" },
      );
    } catch (e) {
      await s.from("media_transcripts").upsert(
        { ...base, status: "failed", error: e instanceof Error ? e.message : "Transcription could not be started." },
        { onConflict: "owner_type,owner_id" },
      );
    }
  } catch (e) {
    console.error("auto transcription failed", e);
  }
}
