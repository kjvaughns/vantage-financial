# Import 224 legacy applicants from the Apex database

Bring every applicant from the uploaded spreadsheet into the portal CRM, with recruiter credit corrected so nothing sits under "Samuel James".

## What the spreadsheet contains

- 224 rows, 17 columns (name, Instagram, email, phone, status, license status, location, manager, upline, age of record).
- Recruiter ("Manager") column: Samuel James 109, KJ Vaughns 85, Xaviar Watts 26, plus 4 one-off names (Moody Imran, dudley bowman, Jacob Causer, Obiajulu Ifediora).
- Statuses: New 110, Contacted 79, Hired 31, Contracted 4.
- License statuses: Unlicensed 166, Licensed unverified 32, Course Started 21, plus a few Passed Test / Finished Course / Waiting on License.
- Data quality: 23 rows flagged DUP, 2 exact duplicate emails, 8 rows with phone/location problems, names stored without spaces ("AkotThip").

## Recruiter assignment

- Every "Samuel James" row becomes **KJ Vaughns** (your existing portal profile) — that is 109 records, including the 73 that also list Samuel James as upline.
- The 26 "Xaviar Watts" rows are assigned to Xaviar's existing portal profile.
- The 85 rows already under KJ Vaughns stay with you.
- The 4 one-off manager names have no portal account, so those applicants are assigned to you and the original manager name is kept on the record as a note for later re-assignment.

## Data cleanup during import

- Split the run-together names into first/last using the Initials column ("AT" + "AkotThip" → Akot Thip), falling back to capital-letter splitting.
- Normalize phone numbers to the portal's existing format; keep unusable numbers as-is and flag them.
- Split "City, ST" into city and state; strip the stray "@email" values out of the Instagram column so only real handles import.
- Skip exact duplicate emails (keep the newest record) and skip anyone whose email already exists among the 19 applicants in the portal today.

## Pipeline stage mapping

| Spreadsheet | Portal stage |
|---|---|
| New | New Applicant |
| Contacted | Contacted |
| Hired + unlicensed / course started | Pre Licensing |
| Hired + passed test / waiting on license / licensed | Licensing |
| Contracted | Contracting |

License status also sets the licensed flag and the recruiting status (pre-licensing, exam, licensing) so the pipeline columns look right.

Record age ("9 week(s) ago") is converted to an approximate created date so the list keeps its true ordering, newest first.

## Important

The import writes records directly to the database — no onboarding, welcome, or stage emails go out to any of these 224 people, and no Discord notifications fire.

## Technical notes

- A one-off Node/Python script parses the workbook and generates a single SQL data-insert statement; the rows go in through the data tool, not a schema migration.
- Fields populated: first/last name, email, phone, city/state, licensed, instagram_handle, current_stage_id, stage_entered_at, status, priority, recruiting_status, assigned_recruiter_id, original_recruiter_id, referred_by_profile_id, referred_by_name_snapshot, source (unknown/manual), consent_contact, created_at.
- After the insert I verify counts per recruiter and per stage, and spot-check a few records in the CRM.
