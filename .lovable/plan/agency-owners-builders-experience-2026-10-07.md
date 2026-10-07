# Agency Owners & Builders experience

## Goal
Give experienced producers and agency owners their own way into Vantage, built around the InsuraCloud Launch Pad, Builder and Owner programs. They see a separate page, can compare the three tracks, apply, and book a 1-on-1 strategy call. Their applications show up in the CRM with an "Agency" tag.

## What visitors will see
1. **Entry points**
   - New "Agency Owners" link in the top menu.
   - A banner under the hero video on the home page: "Agency owner or want to build your own agency? See the owner tracks".
   - A short section near the bottom of the home page with a button to the new page.
2. **New page: /agency** (the page has its own title and link-preview text)
   - Hero: "Build or bring your agency to Vantage".
   - Three track cards: **Launch Pad** (start your first agency), **Builder** (growing producers building a team), **Owner** (established agencies moving their book and team). Each card lists who it fits, what you get (contracts, leads, tech, training, back office) and next steps. Wording follows the InsuraCloud pages, adapted to Vantage.
   - "What you get" grid: carrier access, the Agent Link / Agent Cloud tech stack, lead systems, training through the Academy, recruiting tools and the portal.
   - Simple estimator: team size, average monthly premium per agent, override %. Shows estimated monthly override income, with a clear "estimate only, not guaranteed" note.
   - FAQ and an apply button.
3. **New page: /agency/apply**
   - Step 1: pick a track (Launch Pad / Builder / Owner).
   - Step 2: name, email, phone (same strict US phone check), state, US citizen (No blocks submission, same as /apply), licensed yes/no, NPN (optional), current agency or IMO, team size, monthly production range, goals.
   - Step 3: pick a strategy call time with the same 7-day picker; it books automatically through Cal.com, like /apply.
   - Thank-you page with call details, the VSL, and a reschedule link.

## What you will see in the portal
- Agency applicants go into the normal Applicants list and pipeline with an "Agency – Builder/Owner/Launch Pad" badge, plus a filter for them.
- The applicant record shows their track, team size, production and goals.
- You get the same instant alert (email and Discord) as other new applicants, labelled as an agency lead.
- Referral links (?ref=) still credit the recruiter.

## Emails
- One confirmation email for agency applicants with call details, a reschedule link and the VSL, added to the live email list.

## Technical details
- Migration: add nullable columns to `applicants`: `applicant_type text default 'agent'`, `agency_track text`, `team_size int`, `monthly_production text`, `current_imo text`, `agency_goals text`. Add an `agency` row to `applicant_sources`. No breaking changes.
- Extend `submit_application` (or add `submit_agency_application`, security definer) to accept the new fields; reuse the Cal.com booking in `applications.functions.ts`, with an "Agency Strategy Call" note.
- Routes: `src/routes/agency.tsx` → layout, plus `agency.index.tsx`, `agency.apply.tsx`, `agency.complete.$token.tsx`, each with its own head().
- Reuse `PublicShell`, `InterviewSlotPicker`, `StateCombobox`, `phone.ts`, referral helpers.
- Add `agency-application` template in `src/lib/email/catalog.ts`; the Discord/recruiter alert gets an agency label.
- CRM: badge and filter in the Applicants list/pipeline, plus a fields panel in `applicant-record.tsx`.
- Check: typecheck, a browser run of /agency → apply → thank-you, and a check that the CRM record looks right; cancel the test Cal.com booking.

## Open item
- The track wording is based on the InsuraCloud pages. Please confirm the real terms (override %, contract levels) before launch. Until then the page uses general wording with no hard numbers.
