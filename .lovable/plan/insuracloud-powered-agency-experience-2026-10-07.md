# InsuraCloud-powered agency experience

## Goal
Reframe the agency page around two distinct paths powered by InsuraCloud: **Builder** for teams that want to grow under Vantage, and **Owner** for established branded agencies that want infrastructure, contracts, and backend support.

## Public experience
1. Add a visible **Powered by InsuraCloud** treatment on the agency page near the top, with supporting language that Vantage supplies the leadership and agency opportunity while InsuraCloud powers the operating system.
2. Replace the current three-track presentation with two options:
   - **Builder — Build under Vantage:** for producers, teams, or early agencies that do not need separate branding yet. Vantage covers lead costs indefinitely, provides an AI dialer for the builder and their agents, supplies FEX, Veteran, and Mortgage Protection leads, trains the team, and brings them into Vantage culture and leadership.
   - **Owner — Power your own agency:** for established agencies keeping their own branding, training, recruiting, and sales operation. Position InsuraCloud as the infrastructure layer: agency branding, one-link contracting, 20+ carrier contracts, leaderboards, finance management, multi-carrier book-of-business tracking, backend support, and a path to become an IMO with multiple agencies underneath them.
3. Rewrite the benefits and FAQ sections so the promises and audience match these two paths. Remove Launch Pad everywhere on the public agency journey.
4. Change the calculator to **Estimated annual override** by multiplying the current monthly estimate by 12. Keep the estimate-only disclaimer and clarify that contract levels, placement, persistency, and chargebacks affect actual results.
5. Update the home-page agency prompts and navigation wording so visitors are invited to either build under Vantage or power an existing agency with InsuraCloud.

## Application and follow-up
1. Reduce track selection on `/agency/apply` to Builder and Owner, including incoming links and page metadata.
2. Keep the existing agency questions and automatic strategy-call booking, but tailor labels and helper copy to the selected path.
3. Preserve older `launch_pad` application records for history, while preventing new Launch Pad submissions.
4. Update agency labels wherever they appear in booking notes, applicant badges, and applicant details. Historical Launch Pad records remain readable as “Legacy Launch Pad.”
5. Complete the agency-specific follow-up promised by the original build: confirmation email with call details, reschedule link, and VSL; agency-labelled recruiter/Discord alerts; an Agency filter in Applicants; and visible agency fields in the applicant record.

## Technical details
- Keep the stored identifiers `builder` and `owner`; retain `launch_pad` only as a legacy read value in backend and portal mappings.
- Update validation so public submissions accept only Builder or Owner while existing records remain compatible.
- Use `src/lib/email/catalog.ts` for live agency email copy and the existing Cal.com/reschedule flow.
- No new agency table is required; the existing applicant agency columns remain the source of truth.

## Verification
- Check `/agency` at desktop and mobile sizes for the InsuraCloud attribution, two-option comparison, and annual calculator.
- Test both track links into `/agency/apply` and confirm Launch Pad can no longer be selected or submitted.
- Submit one safe end-to-end test, verify its CRM badge/filter/details, email and alerts, then cancel the test Cal.com booking.
- Confirm historical Launch Pad records still render without errors and run the project checks.
