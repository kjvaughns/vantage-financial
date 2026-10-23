# Show every applicant in a manager's full downline

## What's wrong today
- The Applicants tab opens on "Mine" by default, which only shows applicants assigned directly to you. Your recruits' recruits are hidden until you change the dropdown (and the choice is remembered per device).
- "Direct" only goes one level down.
- Access rules match an applicant to the hierarchy by assigned/original recruiter, but not by "Referred by" — so an applicant referred by someone deep in your tree but assigned elsewhere can be missed.
- The list stops at 200 rows, so large trees get cut off silently.

## Changes
1. **Default to "My organization"** for anyone with downlines: you plus every level beneath you (recruit → their recruits → and so on). Agents with no downline still see their own. Rename scope options to: My organization (default), Just mine, My direct team, Everything (admins only).
2. **"Just mine"** includes applicants you're the assigned recruiter, original recruiter, or referrer for.
3. **Hierarchy access also counts "Referred by"**, so anyone in the chain above the referrer can see that applicant (read only; editing rules unchanged).
4. **No silent cutoff**: add "Load more" beyond the first 200, with a total count shown.
5. Reset the saved scope once so everyone lands on the new default.
6. Apply the same full-depth rule to the "Referred by" filter list so managers can pick any agent in their tree.

## Technical details
- Migration: replace `hierarchy reads downline applicants` policy to also check `is_descendant(auth.uid(), referred_by_profile_id)`; add own-read for `referred_by_profile_id = auth.uid()`.
- `listApplicants` in `src/lib/portal.functions.ts`: scope `downline` becomes default and relies on RLS; `mine` uses an OR across the three recruiter columns; add `offset` + exact count.
- `applicants/index.tsx`: new labels, new localStorage key, Load more button.
- Verify by signing in as a manager with a multi-level tree and comparing counts against a direct database count of their descendants' applicants.
