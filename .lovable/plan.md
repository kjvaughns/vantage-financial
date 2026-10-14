# Agency leads in the CRM + "Referred by" filter

## What's there today
- Builder/Owner applications already save to the applicant list with an "Agency" badge, and an alert goes to the referring agent, or to the house recruiter if nobody referred them. No real agency application has come in yet (all 317 applicants are agent applicants), so this has never run with a real lead.
- Referral links (`?ref=`) only get picked up on the home page. If someone opens `/agency?ref=jane`, Jane isn't credited. The agency form also has no "who referred you" question, so unreferred leads get saved as "Agency Owners page".
- The Applicants page has no way to filter by who referred someone.

## 1. Every agency lead reaches your inbox with all their answers
- Every Builder/Owner application emails you (the house recruiter set in Admin → Settings), even if another agent referred them. The referring agent still gets their own copy.
- The alert shows every answer, not just a one-line summary:
  - Builder: number of downlines, monthly production, the priorities they picked and their "Other" note.
  - Owner: agency name, number of active writers, bottleneck, what they need help with.
  - Both: licensed status, NPN, state, booked call time, who referred them, and their Path Finder answers and recommendation if they took it.
- The Discord alert and the call notes get the same details in shorter form.
- The applicant's activity log records "Agency application submitted" with these answers.

## 2. Agent vs agency applicants are easy to tell apart
- Add a Type filter on Applicants: All / Agent / Agency – Builder / Agency – Owner. It replaces the current "Agency" tab, and the Pre-Licensing tab stays.
- Builder and Owner get separate badge colors in the list, the board and the pipeline. Agent applicants get a quiet "Agent" tag.
- The type count shows next to the filter.

## 3. "Referred by" filter
- Add a Referred by dropdown on Applicants listing active agents, plus "Unassigned / found us directly". Pick an agent to see only their applicants.
- It works with the search, stage and type filters, so you can show, for example, only Jane's Builder leads.
- Your choice stays in the page link, so a filtered view can be bookmarked or shared.

## 4. Referral links work the same on agency pages
- `?ref=` is picked up on `/agency`, `/agency/path` and `/agency/apply`, just like the home page. Credit carries from the Path Finder into the application.
- The agency application gets the same "Who referred you?" picker as `/apply`: search active agents, type a name, or pick "found you directly". It fills in automatically when they came from a referral link.
- Each agent's recruiting link card in the portal gets a second "Agency link" (`/agency?ref=their-slug`) to share.

## Technical details
- `submit_application` already stores the referral fields. Agency apply sends the real `referral_source` from the picker or the link instead of the hardcoded "Agency Owners page".
- Shared `captureReferral()` helper (moved out of `index.tsx`) is used by the home and agency pages.
- Alerts: always add the house recruiter as an extra recipient when `applicant_type = agency` (skipped if they are the referring agent). Build a full "answers" block in the `agent-new-applicant` email data. Path Finder answers are passed from session storage into the submission and saved to the applicant activity.
- Applicants list: add `referrer` and `type` filters on the client using `referred_by_profile_id` / `assigned_recruiter_id` and `applicant_type` / `agency_track`, stored in search params. The agent list comes from the existing recruiter search.
- No database changes needed.

## Verification
- Send one Builder and one Owner test application through `?ref=` without picking a call time. Check that both appear with the right badge and referrer, the filters isolate them, and the alert emails list every answer.
- Delete the test applicants afterwards. Typecheck plus a mobile/desktop check of the filters.
