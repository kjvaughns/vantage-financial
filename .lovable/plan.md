# Qualify Builders and tailor the agency application

## Goal
Make the Builder path exclusive to applicants who already have downlines, and show each path only the questions needed to assess that applicant.

## Public agency page
- Rewrite the Builder description so it clearly requires an existing downline or team; remove language suggesting it is for individual producers.
- Keep Owner positioned for established, independently branded agencies seeking InsuraCloud infrastructure, contracts, and backend support.
- Update the comparison and FAQ copy so applicants can confidently choose the correct path before opening the form.

## Agency application
- Keep the shared contact, citizenship/work authorization, licensing, referral, consent, and strategy-call booking fields.
- When **Builder** is selected, require:
  - Number of current downlines, with a minimum of 1.
  - Current monthly team production.
  - A multi-select checklist for Leads, Systems, Training, Leadership, and Compensation.
  - An “Other” option that reveals a required text field when selected.
- When **Owner** is selected, require:
  - Agency name.
  - Number of active writers.
  - Current bottleneck.
  - What they need help with.
- Clear incompatible path-specific answers when the applicant switches paths, so hidden values are never submitted by mistake.
- Validate every conditional requirement in both the page and the server before saving or booking.

## Portal and notifications
- Store the new path-specific answers as structured applicant fields while keeping existing historical agency records readable.
- Update the applicant record’s Agency Application panel to show Builder downlines, production, and selected priorities, or Owner agency name, writers, bottleneck, and requested help.
- Include the most useful path-specific summary in the recruiter email, Discord alert, and Cal.com strategy-call notes.
- Keep the existing Agency filter and Builder/Owner labels intact.

## Technical details
- Apply one additive database migration for nullable agency name, Builder priorities/other detail, Owner bottleneck, and Owner help-needed fields; continue using the existing team-size field as downline count for Builders and writer count for Owners.
- Extend the existing validated agency submission object with a discriminated Builder/Owner shape, including length limits and a fixed allowlist for checklist values.
- Preserve `launch_pad` only for displaying historical records; new applications remain limited to `builder` and `owner`.

## Verification
- Check Builder cannot submit with zero downlines, no priority, or missing “Other” detail.
- Check Owner cannot submit without agency name, writer count, bottleneck, and help-needed answers.
- Check switching paths removes hidden answers and displays the correct fields on mobile and desktop.
- Verify both paths save the correct fields, appear correctly in the portal, and produce path-specific email/Discord/call-note content without creating an unnecessary live booking during testing.
- Confirm typecheck and preview build pass.