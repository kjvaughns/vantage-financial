# Make the onboarding email account-creation only

## Goal
The email sent when an applicant enters Onboarding will contain exactly one actionable link: their unique **Create my agent account** registration button. All onboarding resources remain inside the portal checklist.

## Changes
1. Simplify the live `welcome-onboarding` email in `src/lib/email/catalog.ts`:
   - Keep a short welcome and explain that setup continues in the portal.
   - Keep only the secure **Create my agent account** button.
   - Remove the five-step instructions and the AgentLink, Discord, and Academy details from the email.
   - Keep the note that the registration link is unique and opens the checklist after account creation.
2. Add a narrow email-display option so this template does not receive the shared applicant-email extras:
   - No automatic Discord invitation.
   - No Instagram link.
   - No email-preferences link in this email.
   - Other applicant emails keep their existing footers and links.
3. Align the separate account-invitation catalog entry with the same concise, portal-first wording so an alternate invitation send cannot reintroduce onboarding resource links.
4. Render both onboarding email definitions during verification and confirm each output has one URL only, pointing to the recipient's secure account-creation/onboarding invitation.

## Technical notes
- `src/lib/email/catalog.ts` remains the live delivery source; the older JSX onboarding template will not be used as the fix target.
- The existing tokenized onboarding URL generation remains unchanged.
- No portal onboarding steps, external resource destinations, or account-creation behavior will change.
