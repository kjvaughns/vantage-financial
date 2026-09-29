# Make the VSL required viewing before every 1:1

Goal: every recruit watches the opportunity video (youtu.be/F6PHSd9JtQs) before the call, so calls are spent closing, not explaining.

## What gets built

1. **Shareable watch page (`/watch`)**
   - Big branded video player, short "Watch this before our call" headline, 3 bullet takeaways, and an Apply / Book button that keeps the recruiter's referral.
   - Works as a link you can text or DM anyone (e.g. `vantage-financial.net/watch`). Own title and link preview.

2. **Application success pages (licensed and unlicensed)**
   - Video placed at the very top with a gold "Required before your 1:1" label, above the existing next steps.
   - A "I've watched it" checkmark button that records it on the applicant's record.

3. **Applicant emails**
   - Application confirmation emails (licensed and unlicensed) and the interview reminder email get a "Watch before your call" section with a video-thumbnail-style button linking to `/watch`.

4. **Agent portal**
   - Applicant record shows "Watched VSL" (yes / not yet, with date) so you know who is ready before you dial.
   - The recruiter new-applicant email and Discord alert mention whether they've watched it (initially "not yet").

## Technical details
- Shared constant `VSL_YOUTUBE_ID` + `VslPlayer` component (youtube-nocookie embed) reused by home, `/watch`, and success pages.
- Migration: add `vsl_watched_at timestamptz` to applicants; token-based public server function `markVslWatched(token)` sets it once; activity log entry `vsl_watched`.
- Email shell gets a `VslCallout` block linking to `/watch` (emails can't play video inline).
- Record drawer reads the new column.
