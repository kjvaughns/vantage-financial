# Update pre-licensing link to the VANTAGE start page

New link everywhere: `https://getlicensed.useagentcloud.com/start?code=VANTAGE`. Partner code **VANTAGE** stays clearly stated alongside it.

## Changes
1. `src/lib/next-steps.ts`: set the shared course link to the new URL. This updates the unlicensed success page button, email `{{course_link}}` links, and the pre-licensing email in `src/lib/emails/catalog.ts` automatically. State requirements link (`/states`) stays the same.
2. `src/lib/email/catalog.ts` (live emails, 3 spots): replace the bare text "getlicensed.useagentcloud.com" with the full new link, keeping "use partner code VANTAGE".
3. Unlicensed success page: make sure the partner code VANTAGE appears right next to the course button (add a short "Partner code: VANTAGE" note if it's missing).
4. Final search to confirm no old course link text remains.
