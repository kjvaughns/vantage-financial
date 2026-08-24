import { createFileRoute } from "@tanstack/react-router";

/** Temporary diagnostic: reports whether the Discord recruiting webhook resolves. */
export const Route = createFileRoute("/api/public/hooks/discord-selftest")({
  server: {
    handlers: {
      GET: async () => {
        const { getDiscordWebhookUrlAsAdmin } = await import("@/lib/discord.server");
        try {
          const url = await getDiscordWebhookUrlAsAdmin();
          return Response.json({ resolved: !!url, host: url ? new URL(url).host : null });
        } catch (e) {
          return Response.json({ resolved: false, error: String(e) });
        }
      },
    },
  },
});
