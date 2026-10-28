/**
 * Copies Drive-hosted Academy media into the private `academy-media` bucket the
 * first time it's played, so the Vantage player can stream it quickly. Each
 * source URL is copied once (tracked in academy_media_cache).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveMedia } from "@/lib/academy/media";

const MAX_BYTES = 150 * 1024 * 1024;
const RETRY_AFTER_MS = 6 * 60 * 60 * 1000;
const EXT: Record<string, string> = {
  "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav",
  "audio/x-wav": "wav", "audio/webm": "webm", "audio/ogg": "ogg", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};

export const ensureAcademyMediaCached = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().url().max(2000), kind: z.enum(["audio", "video"]) }).parse(d))
  .handler(async ({ data }) => {
    const media = resolveMedia(data.url);
    if (media.kind !== "drive" || !media.fetchUrl) return { url: null as string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const sign = async (path: string) => {
      const { data: s } = await sb.storage.from("academy-media").createSignedUrl(path, 60 * 60 * 6);
      return s?.signedUrl ?? null;
    };

    const { data: hit } = await sb.from("academy_media_cache").select("*").eq("source_url", data.url).maybeSingle();
    if (hit?.storage_path) return { url: await sign(hit.storage_path) };
    if (hit?.failed_at && Date.now() - new Date(hit.failed_at).getTime() < RETRY_AFTER_MS) return { url: null };

    const fail = async () => {
      await sb.from("academy_media_cache").upsert({ source_url: data.url, storage_path: null, failed_at: new Date().toISOString() });
      return { url: null as string | null };
    };
    try {
      const res = await fetch(media.fetchUrl, { redirect: "follow" });
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      const len = Number(res.headers.get("content-length") ?? 0);
      if (!res.ok || type.startsWith("text/") || type.includes("html") || len > MAX_BYTES) {
        await res.body?.cancel();
        return fail();
      }
      const buf = await res.arrayBuffer();
      if (!buf.byteLength || buf.byteLength > MAX_BYTES) return fail();
      const ctype = type && type !== "application/octet-stream" ? type : data.kind === "video" ? "video/mp4" : "audio/mp4";
      const id = media.fetchUrl.match(/id=([\w-]+)/)?.[1] ?? crypto.randomUUID();
      const path = `drive/${id}.${EXT[ctype] ?? (data.kind === "video" ? "mp4" : "m4a")}`;
      const { error } = await sb.storage.from("academy-media").upload(path, buf, { contentType: ctype, upsert: true });
      if (error) { console.warn("[media-cache] upload failed", error.message); return fail(); }
      await sb.from("academy_media_cache").upsert({ source_url: data.url, storage_path: path, content_type: ctype, failed_at: null });
      return { url: await sign(path) };
    } catch (e) {
      console.warn("[media-cache] import failed", e);
      return fail();
    }
  });
