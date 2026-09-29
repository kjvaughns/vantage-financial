# Fix automatic Cal.com booking + update thank-you pages

## What went wrong
Your test application did reach Cal.com, but Cal.com rejected it: your 15-minute meeting has a required question, **"Recruit Status"** (Unlicensed / Licensed / Licensed with downlines), and the booking didn't send an answer. So no booking was made, and the thank-you page showed the old Calendly fallback.

## Fixes

1. **Answer your Cal.com questions automatically**
   - Recruit Status: "Licensed" or "Unlicensed" based on what they picked on the form.
   - Instagram Handle: filled in when they give one.
   - Notes: who referred them and their state.

2. **Licensed thank-you page**
   - Remove the embedded Calendly calendar.
   - If booked: show a "You're booked for [day & time]" confirmation, then the VSL and next steps.
   - If the booking failed or they didn't pick a time: show a button to your Cal.com 15-min page instead of Calendly.

3. **Unlicensed thank-you page**
   - Remove all "Confirm on Calendly" / Monday overview wording and links.
   - Same "You're booked" confirmation, with a Cal.com button only as a fallback.
   - Keep the VSL, licensing steps and Discord invite.

4. **Check it end to end**: submit a test application, confirm the booking shows up on your Cal.com calendar and the thank-you page says you're booked. I'll cancel the test booking afterward.

## Technical details
- `src/lib/calcom.server.ts`: add `licensed` and `instagram` inputs; send `bookingFieldsResponses: { "Recruit-Status", "Instagram-Handle", notes }`.
- `src/lib/applications.functions.ts`: pass those through; store the booking result so success pages can read it from the backend instead of only sessionStorage (e.g. use `requested_overview_at` + scheduled status in the success context).
- `licensed.$token.tsx` / `unlicensed.$token.tsx`: drop `CalendlyInline` / `getOverviewBooking`; fallback link = `CAL_BOOKING_URL` prefilled with name/email.
