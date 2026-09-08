# Better duplicate applicant detection

Right now nothing checks for an existing applicant when a new application comes in, so the same person can create a second record minutes later (two live cases today: one applied twice 7 minutes apart, another 10 hours apart). Manual "Add applicant" has no check either, and two records already share a phone number with slightly different email spellings.

## What changes for you

1. **Re-applying updates the existing record instead of creating a new one.** If someone applies again with the same email — or the same phone number plus the same last name — their existing record is refreshed with the newer answers (licensing, state, why, Instagram, overview date) and they continue to the correct success page as usual. Their recruiter, stage and history stay intact.
2. **A note is logged on the record** ("Applicant re-submitted the application"), so recruiters can see they applied twice rather than losing that signal.
3. **Manual "Add applicant" warns before saving.** As soon as the email or phone is filled in, if a matching applicant already exists you get an inline warning with their name and current stage, plus a link to open that record. You can still continue on purpose (confirm), but you won't create a duplicate by accident.
4. **A "Possible duplicates" section for cleanup** in the CRM listing applicants who share an email or phone number, so the existing pairs (including the mismatched-email ones) can be reviewed and archived by hand.

## Technical notes

- Add a normalized-phone helper and a `find_applicant_duplicates` lookup used by both paths. Match rules, in order: exact lower(email); then normalized 10-digit phone + lower(last_name). Ignore archived records.
- `submit_application` (database function) gains an up-front duplicate lookup. On a match it updates the existing row (contact + licensing + why + instagram fields, refreshes `success_page_type` and mints a fresh `confirmation_token`) rather than inserting, inserts an `application_resubmitted` activity, and returns that row's id/token so the rest of the flow — success page, emails, Discord alert — is unchanged. Recruiter/referral attribution is never overwritten when already set.
- New server function `checkApplicantDuplicate` (in `src/lib/portal.functions.ts`, auth-required) returning `{ id, name, stage, email, phone }` for the manual modal; `createApplicantManual` also rejects a duplicate unless the caller passes `confirm_duplicate: true`.
- `add-applicant-modal.tsx`: debounced duplicate check on email/phone blur, warning banner, confirm-to-continue.
- Possible-duplicates panel: read-only query grouping non-archived applicants by email and normalized phone, surfaced on the CRM index.
