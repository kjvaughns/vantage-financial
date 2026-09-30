# Assign a contracting link when an applicant moves to Onboarding

## Goal
When a recruiter moves an applicant into the Onboarding stage, make it one simple step to assign the upline's AgentLink contracting link — so the new agent's onboarding step 1 already has the right link.

## How it works today
- The assigned contracting link is stored on the agent's profile (`profiles.assigned_agentlink_link_id`), but applicants have no such field, so nothing can be assigned until after they accept the portal invitation.
- Moving an applicant to Onboarding (stage dropdown or "Move to next stage" on the Applicants page, or the stage field on the applicant record) just changes the stage — no link prompt appears.

## Changes

1. **Store a pending link on the applicant**
   - New migration: add `applicants.assigned_agentlink_link_id` (references `agentlink_links`, null allowed) with grants.
   - When the applicant is promoted to an agent / accepts their portal invitation, copy this value onto the new profile's `assigned_agentlink_link_id` (in `promote_applicant_to_agent` / `finalize_invitation_acceptance`), so step 1 of onboarding shows the link immediately.

2. **Prompt on stage change to Onboarding**
   - On the Applicants page (list and pipeline views) and on the applicant record page: whenever a stage change targets the Onboarding stage, after the stage saves, open a small "Assign contracting link" popup.
   - The popup lists the active AgentLink links of that applicant's upline (their assigned recruiter, falling back to original recruiter), with one-click assign.
   - If the upline has no links yet, the popup offers an inline "Add link for [upline]" field (label + URL) that creates and assigns it in one step — same pattern as Admin > Users.
   - A "Skip for now" option closes the popup without blocking the stage change.

3. **Visible reminder for unassigned onboarding applicants**
   - Applicants in the Onboarding stage without an assigned link get a small "No contracting link" badge in their row and on their record page, with an "Assign link" button that reopens the same popup.

4. **Backend**
   - New `assignApplicantAgentLink` server function: validates the link is active and owned by the applicant's upline, then saves it on the applicant.
   - Reuse the existing admin-on-behalf link creation (`saveAgentLink` with `owner_id`) for the inline add-link case.

## Technical details
- Migration adds one column to `applicants` with FK to `agentlink_links(id)` ON DELETE SET NULL, plus GRANTs (authenticated update via existing applicant policies).
- Upline resolution: `assigned_recruiter_id` ?? `original_recruiter_id` ?? `referred_by_profile_id`.
- Files touched: new migration, `src/lib/portal.functions.ts` (new function + list query includes the new column), `src/routes/_authenticated/portal/applicants/index.tsx`, `src/components/vantage/applicant-record.tsx`, and the promotion/invitation SQL functions to carry the link over.
- Steps 2+ of onboarding are untouched; the agent-confirmed completion and upline notification stay as-is.

## Verification
- Move a test applicant to Onboarding, pick a link in the popup, confirm it appears on the agent's profile after promotion and in onboarding step 1.
- Test skip, no-links (inline add), and wrong-upline link rejection.
- Typecheck and a signed-in browser check of the popup on desktop and mobile widths.
