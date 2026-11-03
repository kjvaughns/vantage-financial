# Switch prelicensing partner to Agent Cloud: Licensing

## What changes
- New course website everywhere: **https://getlicensed.useagentcloud.com** (replaces getlicensed.insuracloud.ai).
- State requirements link becomes **https://getlicensed.useagentcloud.com/state-requirements** (same path on the new site; I'll confirm it loads, otherwise point to the homepage).
- Partner code **VANTAGE** shown prominently wherever applicants are told to enroll, with a "use code VANTAGE at checkout" instruction.
- Partner named "Agent Cloud: Licensing" in the copy.

## Where it shows up
- Unlicensed application success page: course card names Agent Cloud: Licensing, shows the VANTAGE code (with copy button), links to new site.
- Course-purchased page: state requirements link updated.
- All unlicensed emails in the live email catalog (application received, pre-licensing next steps, course reminders, weekly licensing check-ins, missed-interview/reschedule): new site, partner name, and code VANTAGE.
- Shared email footer course button and legacy templates updated so nothing points to the old site.
- Any applicant-facing portal/onboarding text mentioning the course.

## Not changed
- Agency (Builder/Owner) "Powered by InsuraCloud" branding stays as is.
- Licensed applicant flow unchanged.

## Technical details
- Update `XCEL_COURSE_URL`, `STATE_REQUIREMENTS_URL`, set `XCEL_PARTNER_CODE = "VANTAGE"` and add a partner-name constant in `src/lib/next-steps.ts`; expose `partner_code` in `src/lib/email/links.ts`.
- Replace hardcoded "getlicensed.insuracloud.ai" strings in `src/lib/email/catalog.ts` (lines ~144, 347, 1028) and audit remaining copy there plus `src/lib/emails/catalog.ts`, `email-templates/*`, success pages.
- Final `rg` sweep to confirm no old URL remains outside agency pages.
