# Self-referral option, Instagram everywhere, updated team schedule

## 1. "I found Vantage on my own" on the application

The referrer picker gets a first, pinned option: **I found Vantage on my own** (with a note: Instagram, TikTok, a friend, or searching). Picking it:

- Leaves the recruiter unassigned instead of forcing a name, so nobody lands under Alonzo just because he sits at the top of the list.
- Records the source as "Found us directly", including the referral text they typed if any.
- Sends the new-applicant alert (email + Discord card) to KJ so the lead is claimed immediately.
- Shows in the CRM as an unassigned company lead with a clear badge, so you can set the real recruiter from the applicant drawer.

The list order changes too: no agent is preselected by default, so the first tap is always a deliberate choice. Referral links still preselect that agent as they do today.

## 2. Team Instagram

- Landing page footer gets a **Follow @vantage.financial** link next to the existing footer links.
- Emails already carry the Instagram line in the shared footer; it will be checked and made consistent across the catalog-rendered emails and the React Email templates so every email has it.

## 3. Discord for every new applicant

Both success pages (licensed and unlicensed) already show a Discord button; the plan confirms both, and both confirmation emails ("application received" licensed and unlicensed) will carry the Discord invite prominently, not just in the footer block.

## 4. Updated team schedule

New canonical schedule, used everywhere:

| Item | New time |
| --- | --- |
| Monday team meeting (mandatory) | 9:00 AM |
| New agent training (agency-wide, weekly) | Monday 10:00 AM sharp |
| New agent live training (daily, new agents) | 30 minutes earlier than today |
| Company overview | Monday 7:00 PM |
| Agency training | Wednesday 10:30 AM (unchanged) |
| Film review | Monday, Tuesday, Wednesday, Thursday 6:00 PM in the Training Room — mandatory for anyone who hasn't closed a deal that day |
| Live dials | 10-6 daily |

Assumption to confirm if wrong: "new agent live training moved back 30 minutes" is read as 30 minutes earlier, matching the other two moves.

Every place that repeats the schedule is updated from a single shared source so it can't drift again: the portal onboarding "Expectations & Schedule" step, the onboarding/expectations emails, the weekly game-plan campaign defaults, and the licensing/training check-in copy.

## Technical notes

- New `src/lib/schedule.ts` exporting the canonical schedule lines; consumed by `src/routes/_authenticated/portal/onboarding.tsx` and `src/lib/email/catalog.ts` (lines ~417, ~478, ~1054) plus `src/lib/emails/catalog.ts`, replacing the hardcoded times.
- `src/components/vantage/recruiter-combobox.tsx`: add a pinned `self` selection (`RecruiterSelection` gains `self?: true`); no auto-select of search results.
- `src/routes/apply.tsx`: validation accepts the self option; submits `referral_source: "self"` with empty `referred_by_profile_id`.
- `src/lib/applications.functions.ts` / `submit_application`: store `referral_source = 'self'`, leave recruiter null, and route the recruiter alert to the house recruiter (KJ) resolved by a `house_recruiter_profile_id` row in `system_settings` rather than a hardcoded id.
- `src/components/vantage/brand.tsx`: Instagram link in `PublicFooter` using `INSTAGRAM_URL`.
- CRM: unassigned-lead badge in `src/components/vantage/applicant-record.tsx` and the applicants list.
- No schema change beyond the one `system_settings` key.
