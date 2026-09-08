# Admin-Editable Onboarding, Training & Academy

Goal: move Vantage's onboarding, training details, and Academy starter content out of the code and into the admin portal, following the Everstone approach where admins control everything without edits to code.

## What the audit found

Everstone (referenced project) does three things Vantage currently does not:

- Onboarding is stored as data — editable **sections** and **steps**, each with sort order, published flag, who it applies to, a button/action (external link, internal page, course, resource, file), and how it gets completed (agent checks it, admin marks it, or it completes itself when a course is finished).
- Everything else agents see (courses, library, presentations, announcements) carries a "who can see this" setting, so one toggle controls visibility.
- Global settings (support contacts, signup code, default access level) live in a single settings screen.

Vantage today: the 5 onboarding steps are hardcoded in `src/lib/onboarding.ts` and repeated in the onboarding page, the CRM indicator, emails, and server functions. The team schedule and links (Discord, Xcel course, playbook, Agent Cloud, NIPR) are hardcoded in `src/lib/schedule.ts` and `src/lib/next-steps.ts`. Academy content already has published/draft status and full admin managers for recordings, library and courses.

## What gets built (onboarding first)

### 1. Onboarding becomes editable content
New tables for onboarding sections and steps. Each step has: title, description, optional instructions, order, published on/off, required/optional, an action (no button, external link, internal portal page, an Academy course, a library resource, or a recorded presentation), a button label, and a completion mode — agent self-check, admin confirms, or automatic when the linked course is completed.

Existing agents keep their progress: the current five steps are inserted as the starting content with their existing keys, so nothing that is already checked off gets lost. Progress moves to a proper per-agent progress table, backfilled from today's stored checklist.

### 2. Admin onboarding builder
A new "Onboarding" area in the admin portal: list of sections with steps nested underneath, add / edit / duplicate / delete, move up and down, publish or unpublish, and a live preview of what a new agent sees. Plain-language help text on the screen explains each option.

### 3. Automatic completion from training
When an agent finishes an Academy course that a step is linked to, that step ticks itself off. This replaces the one hardcoded "Closer Course" special case with a general rule any step can use.

### 4. Per-agent onboarding view for leaders
On the applicant/agent record in the CRM: the real step list with who completed what and when, plus the ability for an admin to mark an admin-confirmed step complete.

### 5. Training schedule and links editable
An admin "Training & links" settings screen holding the weekly schedule items (label, when, note, order, show/hide) and the shared links (Discord invite, licensing course, state requirements, NIPR, Agent Cloud, playbook, team Instagram). The portal onboarding page, the schedule step, and every email read from these instead of hardcoded constants. Existing values are seeded so nothing changes visually on day one.

### 6. Academy starter templates
In Academy management, a "Start from a template" option: pick a starter course outline (or library set), it creates a draft copy the admin then edits and publishes. Templates are stored as data too, so new ones can be added later without code. Also adds "duplicate" on courses, recordings and library items so an admin can clone anything as a starting point.

## Out of scope for this round

Multiple agencies / white-label branding (colors, logo, agency name) — noted as a later step; this round keeps a single agency but makes content admin-owned so that change is easy afterwards. Certificates and gamification are not part of this.

## Technical notes

- Migration adds `onboarding_sections`, `onboarding_steps`, `onboarding_step_progress`, `training_schedule_items`, `app_links` (or a keyed `system_settings` extension), and `academy_templates`; every table gets GRANTs, RLS enabled, admin/`can_manage_resources` manage policies, and authenticated read on published rows. Seed rows literally in the migration reproduce today's five steps, the current schedule, and the current links.
- Backfill: `applicants.onboarding_steps` jsonb is read once in the migration to populate `onboarding_step_progress`; the jsonb column stays in place (read-only fallback) so existing emails and CRM counters cannot break mid-deploy.
- `src/lib/onboarding.ts` keeps its key type and labels as a fallback but progress helpers switch to counting published required steps returned from the server.
- Auto-completion implemented as a Postgres trigger on `lesson_progress`/`enrollments` (mirroring Everstone's `sync_auto_licensing_steps`) so the rule holds regardless of which client path completes a lesson.
- New server functions in `src/lib/onboarding.functions.ts` and `src/lib/settings.functions.ts` using the existing `assertCanManage`-style guard; reordering via adjacent sort-order swap.
- Admin UI built from `@/components/portal/ui` only (Panel, Drawer, Toolbar, Badge, Button, notify) to match the portal exactly; new route `src/routes/_authenticated/portal/admin/onboarding.tsx` plus a training/links tab under admin settings.
- Emails and success pages import the schedule/links through a cached server read with the current constants as compile-time defaults, so email rendering never fails if a row is missing.

## Verification

As admin: add a step with each action type and completion mode, reorder, unpublish, confirm the agent view matches; edit a schedule time and a link and confirm the onboarding page and a rendered email preview both change. As agent: complete self-check steps, finish a linked course and confirm its step auto-completes, sign out and back in and confirm progress persisted.
