<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the applicant email catalog in `src/lib/email/catalog.ts` as the live delivery source, because the older JSX email templates are not used by the current dispatcher.
- Reschedule applicant interviews through a confirmation-token page and Cal.com booking UID, because creating a second booking would leave the original calendar event active.
- Keep AgentLink contracting URLs upline-owned and assign exactly one active link per agent; never restore a universal contracting URL.
- Resolve applicant uplines centrally through the database assignment trigger into assigned_manager_id and use that same resolved leader for AgentLink options and onboarding, preserving referral columns; this keeps public, manual, MCP, and recruiter-edit paths consistent. A user_roles trigger re-resolves automatic uplines (and clears stale AgentLink assignments) whenever someone gains or loses a leader/manager/admin role, so role changes alone re-route contracting to the new leader's link.
- Persist manual applicant uplines separately from automatic defaults; hierarchy edits use a service-only database action validating actor roles, organization scope and loops, because direct profile writes must retain structural guards.
- In admin user lists, authorize the caller before using the server admin client for service-only upline resolution; keep ordinary list reads caller-scoped and surface query errors rather than returning empty lists.
- Keep agency applications on two active paths (`builder` and `owner`); retain `launch_pad` only as a readable legacy value so historical records remain intact.
- Keep HyperAgent/external-assistant MCP tools in src/lib/mcp (OAuth, caller-scoped client) and verify RLS access before any privileged stage-engine call, so external agents never exceed the signed-in user's permissions.
- Gate training days on onboarding completion (or a logged manual unlock) and on approval of the previous day via `computeTrack` (the release day opens on unlock and accepts repeat attempts) in src/lib/training.functions.ts; release passes move the applicant to Active Agent through the stage engine, so progress stays on one record.
- Keep homework link validation in the browser-safe training-homework module and enforce it on submission server-side; preserve existing file submissions for historical review.
- Derive content novelty from creation timestamps through the shared new-content helper and expiring badge component, never the legacy manual is_new flag; navigation reads only caller-visible published content.
- Score Call Coach reviews only against the stored Gold Standard (coach_reference_scripts + active reference calls) and advance processing via client polling in src/lib/coach.functions.ts, so scoring stays consistent and no request runs long on the worker.
- Play every audio/video recording through the shared VantageMedia player (src/components/media) with its synced transcript; Drive links are copied once into private storage via media-cache, so playback is fast and transcript sync works everywhere.
