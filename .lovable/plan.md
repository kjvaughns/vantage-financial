# Get the Discord recruiting alerts firing on real applications

## What's confirmed right now

- The saved webhook is present and well-formed (a valid `discord.com/api/webhooks/...` URL, 121 chars).
- The code in this project already reads that webhook with the trusted server-side connection, so an anonymous applicant submission can see it.
- No applicant has been submitted since that fix landed: the newest applicants are from Aug 22-23, and there are zero `discord_alert` timeline entries. So the fixed path has never actually run in production.

That means the remaining gap is deployment plus proof, not another code change to the lookup.

## Plan

1. Publish the app so the live site runs the current build (the fixed webhook lookup and the timeline logging ship together).
2. Verify end to end by submitting one throwaway application on the live site, then confirm:
   - the card appears in the Discord channel, and
   - a `discord_alert` entry with "posted" shows on that applicant's timeline in the CRM.
3. Delete the throwaway applicant afterwards.
4. If the card still doesn't appear, the timeline entry now names the cause — "no webhook configured" vs. "rejected by Discord" — and I fix that specific cause:
   - "no webhook configured" means the server-side settings read is still blocked, and I widen that read path.
   - "rejected by Discord" means the webhook itself was deleted/regenerated in Discord, and you paste a fresh webhook URL in Admin > Settings.

## Small hardening included

- Surface the Discord outcome in the CRM applicant record (a short "Discord alert posted / skipped / rejected" line on the timeline) so future failures are visible to you without asking me to read server logs.
- Keep it strictly best-effort: a Discord problem must never fail an application submission or delay applicant emails.

## Technical notes

- No migration and no schema change.
- Touch points: `src/lib/discord.server.ts` (already resolves the URL via the service-role client), `src/lib/applications.functions.ts` (already records the outcome to `applicant_activities`), and the CRM timeline renderer to give `discord_alert` a readable label/icon.
