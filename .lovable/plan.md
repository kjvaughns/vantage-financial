# AgentLink onboarding and upline assignment

## Goal
Replace Agent Cloud with an upline-specific AgentLink contracting step while keeping onboarding steps 2 onward unchanged.

## Changes

1. **Make managers usable as uplines**
   - Keep the existing reporting hierarchy, but make the upline selectors explicitly include eligible active managers.
   - Apply the same eligibility rules in invitations, agent administration, and applicant-to-agent promotion so the selected upline remains consistent throughout the agent journey.
   - Prevent invalid self-assignment and hierarchy loops.

2. **Add upline-owned AgentLink links**
   - Give each eligible upline a settings area to create, label, edit, activate, and remove their own AgentLink contracting links.
   - Let an admin or the responsible upline assign exactly one of that upline’s active links to each agent.
   - Restrict managers to their own links and agents in their permitted organization branch; admins retain organization-wide control.
   - Show a clear “link not assigned” state instead of falling back to a universal link.

3. **Replace onboarding step 1**
   - Preserve the existing step identity and completion history, but rename and rewrite it as **AgentLink contracting**.
   - Send the agent only to their assigned upline’s AgentLink link.
   - Instruct them to create the account directly under that upline, complete the entire AgentLink profile to 100%, and add E&O coverage before confirming completion.
   - Keep completion agent-confirmed and continue notifying the appropriate upline when the agent marks it complete.
   - Leave Discord Licensed Role, Agent Playbook, Expectations & Schedule, Vantage Closer Course, and Training unchanged.

4. **Remove obsolete Agent Cloud messaging**
   - Update live onboarding emails, onboarding invitations, portal labels, success-page language, and other active user-facing references found in the current application.
   - Remove the universal Agent Cloud URL so it cannot be shown as a fallback.

5. **Backend and validation**
   - Add protected storage for upline-owned AgentLink links and each agent’s assigned link, with authenticated access rules and explicit grants.
   - Validate that an assignment belongs to the selected upline and is active.
   - Preserve current agents’ onboarding progress; existing agents without an assignment will be prompted to contact their upline.

6. **Verification**
   - Test a manager creating multiple links, assigning one link to an agent, and the agent seeing only that assigned link.
   - Test manager/admin permissions, missing-link behavior, agent self-completion, upline notification, and unchanged steps 2 onward.
   - Verify desktop and mobile views and confirm the app builds without errors.

## Technical details
- Continue using `profiles.parent_user_id` as the reporting/upline relationship.
- Add a dedicated AgentLink-links table plus an assigned-link reference for agents rather than storing a universal URL.
- Keep the existing internal onboarding step key to avoid resetting completed onboarding records; change its visible content and behavior only.
- E&O is an AgentLink profile requirement in the instructions, not a new Vantage profile field.
