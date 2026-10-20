# Onboarding Substeps

Let each onboarding step hold a short checklist of substeps (for example "Create AgentLink account", "Upload E&O", "Profile at 100%").

## Editor (Admin > Onboarding)
- Inside the step edit panel, a new "Substeps" list: type a title, press Enter to add. Each row has an optional short note and optional link, a drag/up-down to reorder, and a remove button.
- Nothing else changes in the editor; steps without substeps work exactly as today.

## Agent view
- Substeps show as checkboxes under the step. Agents tick them off; progress is saved.
- The step's "Mark complete" button unlocks once every substep is ticked (steps with no substeps behave as now).
- Leaders see substep ticks on the applicant's onboarding view.

## Technical notes
- Add `substeps jsonb default '[]'` to `onboarding_steps` (items: id, title, note, url) and `substeps_done jsonb default '{}'` keyed by step key on applicant progress — additive migration, no backfill needed.
- New server fn `toggleOnboardingSubstep` (caller-scoped, own record only); `saveOnboardingStep` accepts substeps (max 20, zod validated).
- `completeOnboardingStep` rejects when published substeps are not all done; auto-completed course steps skip the check.
- UI in `admin/onboarding.tsx` StepDrawer and `portal/onboarding.tsx` StepRow using existing portal UI components.
