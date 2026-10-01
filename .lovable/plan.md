# Stop automatic interview bookings from failing on bad phone numbers

## What happened
The automatic booking for Yadhu (today, 1:15 PM CT) was rejected by Cal.com at 7:38 AM. His number, (964) 549-6211, uses an area code that isn't real, so Cal.com refused it. Your 15-min meeting requires a phone number, so the backup attempt without a phone was refused too.

The booking that later showed up on your calendar most likely came from the applicant using the "Book my 1:1 call" button on the thank-you page. That's why it arrived a few minutes later. Your CRM still shows him as **not scheduled**, and his reminder emails haven't started. Simon's application from yesterday (phone (070) ...) failed the same way.

## Fixes
1. **Real phone check on the application form.** Use the same phone-number rules Cal.com uses, so made-up or unassigned area codes get caught before someone can submit. The same check runs again when the application is saved.
2. **Link manual Cal.com bookings back to the CRM.** When someone books through the thank-you page button, or directly on Cal.com, the applicant gets matched by email. They're marked scheduled with the correct time, and their interview reminders start.
3. **Flag failed bookings.** If an automatic booking still fails, the applicant's timeline records it and you get an email alert. That way it never fails silently again.
4. **Clean up today's records.** Mark Yadhu as scheduled for 1:15 PM CT if the Cal.com booking matches his email.

## Technical details
- Add `libphonenumber-js`. Have `isValidUsPhone` in `src/lib/phone.ts` call `isValidNumberForRegion(..., "US")`, and add a matching check in `applicationSchema`.
- New `src/routes/api/public/webhooks/calcom.ts` handles `BOOKING_CREATED` and `BOOKING_RESCHEDULED`, with Cal.com signature verification through a new `CALCOM_WEBHOOK_SECRET`. It matches applicants by email and saves `scheduled_event_id`, `scheduled_event_start`, and `scheduling_status`, then starts `interview_reminders`. The webhook gets registered with the Cal.com API.
- In `submitApplication`, insert a `booking_failed` activity when `booking_error` is set and email the alert recipient.
