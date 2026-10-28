# Make homework review fast and simple for trainers

## What changes on the Training Review page
- **Counts on each tab:** for example "Waiting on review (4)" and "Ready for release (1)", so you can see at a glance what needs you.
- **Everything on one card, no jumping between pages:**
  - Agent name, training day (for example "Tuesday · Intro–Needs–Medical–Social") and how long ago they submitted.
  - The recording plays right on the card, using the same player as Call Coach.
  - The AI score shows inline: overall score, the 8 pillar bars and the top 3 fixes. While the call is still being analyzed you'll see "Analyzing…", and it updates on its own.
  - A "Full scorecard" link stays for when you want the details.
- **Quick feedback buttons:** tap ready-made notes like "Great intro", "Slow down", "Dig deeper on needs analysis", "Follow the script" or "Missed the close" to add them to your feedback. You can still type your own.
- **Two clear buttons:** a big gold **Approve** and **Send back**. Send back asks for at least one note, so agents always know what to fix.
- **History:** a small "Previous attempts" line shows how many times this day was sent back, plus your last note.
- **Oldest first,** with a filter by agent so you can review one person's work in a row.
- After you approve or send back, the card slides away and the next one is ready.

## Technical details
- `listTrainingReview` (`src/lib/training.functions.ts`): return counts per filter; for each submission include the linked call review's `overall`, `pillar_scores`, `improvements` and `status`, the recording's signed URL or Drive file ID, and the count and last feedback of earlier attempts for the same agent and day. Sort oldest first. Keep it access-checked as it is now.
- `src/routes/_authenticated/portal/admin/training.tsx`: rebuild `ReviewCard` with `CallPlayer`, `ScoreRing`/`PillarBars`, feedback chips that append to the textarea, required feedback on redo, and an agent filter. Poll every 5s while a linked review is still processing.
- Enforce "feedback required for send back" in `reviewSubmission` on the server too.
- No database changes.
