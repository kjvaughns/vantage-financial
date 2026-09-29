# Applicant email and interview rescheduling update

## What applicants will experience
- Application emails will clearly distinguish licensed and unlicensed next steps. Both will point to the opportunity video before the 1:1 interview; licensed applicants will not receive pre-licensing instructions.
- Unlicensed emails will use getlicensed.insuracloud.ai for the course and its `/state-requirements` page, with no old partner code or company-overview language.
- Every relevant interview confirmation, reminder, cancellation, and missed-interview email will offer a clear reschedule link.
- The reschedule link will open a branded page where applicants choose an available day and time over the next seven days. The page will confirm their updated interview without asking them to book a second appointment.

## Technical implementation
- Update the live applicant email catalog and the application-submission email context, retaining the existing branded renderer and admin email editor. Replace obsolete overview/Calendly copy in applicant templates and align onboarding handoff copy with the current sequence.
- Save the Cal.com booking identifier and time when the application automatically books. Use the existing applicant confirmation token to protect the rescheduling page, validate its selected slot against live availability, and use Cal.com's reschedule endpoint for bookings with an identifier. For legacy bookings without one, make a new booking only after verifying the applicant and clearly handle failures.
- Update the applicant's scheduled time, interview reminders, and confirmation email after successful rescheduling. Ensure reminder links do not falsely claim to join the call.
- Verify email rendering and the rescheduling page, including invalid links, no available times, and failed booking responses. Check the preview build and relevant diagnostics.
