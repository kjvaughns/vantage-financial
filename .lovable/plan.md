# Make the agency production webhooks live and working

## What I verified

- The active production cron jobs are present in the backend:
  - `vantage-email-reminders` runs hourly at `:15`.
  - `vantage-email-campaigns` runs daily at `12:00 UTC`.
- Both jobs currently POST to the stable production app URL:
  - `/api/public/hooks/email-dispatch`
- The latest recorded cron response is successful: HTTP `200` with `{ ok: true, job: "reminders" }`.
- The production email outbox is actively sending messages today, so the dispatcher route is reachable and the mail send path is working.
- The Calendly webhook route exists at `/api/public/webhooks/calendly`, but there were no production Calendly webhook logs in the last hour.

## What needs to happen

1. Find the Claude commit/webhook work and compare it against what is currently in the project.
2. Identify every agency production webhook that commit expected to be live:
   - scheduled email dispatcher jobs,
   - agency campaign/announcement jobs,
   - Calendly booking/cancellation webhook,
   - any additional public webhook route added by that commit.
3. For each missing or incomplete webhook, restore the route or backend job from the intended commit behavior.
4. Make sure every external-callable webhook lives under `/api/public/...` so production callers can reach it without a login wall.
5. Make sure each webhook has the correct production URL target, not a preview-only URL.
6. Add/repair logging so each webhook records a clear success/failure trail in the backend tables or server logs.
7. Publish the app so any route/server-function changes become live on the production domains.
8. Verify production end to end:
   - manually invoke each webhook with the expected headers/body when possible,
   - confirm the production server returns `200`,
   - confirm the expected side effect appears in the backend, such as an email row, applicant stage update, or activity log.

## Technical notes

- Existing production cron jobs already point to the stable production host, so I will not replace them with preview URLs.
- If the Claude commit added new webhook endpoints but they are not present in `src/routes/api/public/...`, I will recreate them as TanStack server routes.
- If the commit only added backend cron scheduling but no app route changes, I will apply a backend migration/update for those jobs instead.
- Webhook secrets and publishable keys stay server-side or in backend job headers only; nothing secret is exposed to the browser.

## Acceptance criteria

- All agency production webhooks from the Claude commit exist in the current app/backend.
- Production callers hit the published app, not only preview.
- Each webhook returns a clean success/failure response.
- The affected workflows visibly update: emails send, Calendly booking updates applicant status, and agency campaign/reminder jobs run on schedule.
