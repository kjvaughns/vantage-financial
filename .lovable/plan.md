# Three new recruiting campaigns

Three automated sequences: weekly overview invites, twice-weekly licensing/course check-ins, and a smart reminder ladder for scheduled overviews.

## 1. Weekly overview invite

- Audience: applicants in the New stage, not archived, with no scheduled overview/interview and no completed overview.
- Sends every Thursday morning (7:00 AM CT) with the applicant's own direct registration link (their recruiter's Calendly/overview link, same link logic the success pages use).
- Runs for 4 weeks max. After the 4th send with no booking, the sequence stops and records "no response" on the applicant timeline.
- Stops immediately the moment they schedule, are archived, or move past New.

## 2. Licensing + course check-ins (Tue + Fri)

- Audience: applicants who reached hired/onboarding/pre-licensing and haven't passed the exam yet.
- Two sends per week (Tuesday and Friday, 7:00 AM CT) rotating through the relevant check-in:
  - pre-licensing course progress (Xcel, partner code AFE),
  - Vantage Closer Course / training progress,
  - whether the state exam is scheduled — with the exam-scheduling and NIPR links.
- The email picks the right focus based on what's actually missing on their record (course confirmed, exam date, exam result), so a person who already booked their exam gets the course/training check-in instead.
- Stops when the exam is passed or the applicant is archived.

## 3. Interview / overview reminder ladder

- Ladder before the scheduled start: 6 days, 4 days, 2 days, 1 day, 3 hours, 30 minutes.
- Anchored to the applicant's *current* scheduled event. If they reschedule, the ladder re-anchors to the new time and any stale touches are dropped, so a booking from a month ago can never fire.
- Cancellation (or a no-show mark) stops the ladder.
- Each email states the actual date/time in the recipient's timezone plus the join link for that specific event.
- No recruiter copies on any of the three campaigns.

## Technical notes

- Reuse the existing `applicant_sequences` engine and `/api/public/hooks/email-dispatch`. New sequence kinds: `overview_invite`, `licensing_checkins`; the existing `interview_reminders` ladder is extended from 144/96/48/24h to 144/96/48/24/3h/30m.
- Re-anchoring: store the event identity alongside the anchor so a reschedule invalidates prior touches; the Calendly webhook and manual schedule edits both call `startSequence` with the new start time, and cancellation calls `stopSequence`.
- Cron: the reminder job must move from hourly to every 15 minutes so the 30-minute touch is accurate. Campaign sweeps stay on the daily 12:00 UTC job, gated by CT weekday.
- New rows in `email_campaigns` for the two new campaigns (enable/disable, edit copy, send test from Admin → Emails) plus new templates in the email catalog: overview invite, licensing check-in, course check-in, exam check-in, and 3h/30m reminder variants.
- Small migration: add the event-identity/anchor columns to `applicant_sequences`, allow the new sequence kinds, and seed the two campaign rows.
- Dedupe keys per (applicant, sequence, touch) keep repeated cron runs harmless.

## Acceptance

- A new applicant with no booking gets exactly 4 weekly invites, then stops.
- A hired applicant in pre-licensing gets a relevant check-in Tuesday and Friday, and no exam nudge once the exam is passed.
- Booking, then rescheduling, produces reminders only for the new time — including one 30 minutes before.
