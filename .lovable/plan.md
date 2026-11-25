# Producer Profile (Vantage portal)

Since the question was skipped, this builds the page inside the Vantage portal. It's a new **Producer Profile** page under Settings that puts everything on one scrolling page instead of separate tabs.

## What agents will see
One page with these sections, in this order, and one Save button:

1. **Personal information**: first and last name, phone, email (read-only), date of birth, NPN with the existing lookup, and resident state.
2. **Home address**: street, city, state, ZIP.
3. **Sensitive IDs**: Social Security number, masked as `***-**-1234` after it's saved, with a "Reveal" button only you can use.
4. **Driver's license**: license number, issuing state, expiration date, and uploads for the front and back photos with thumbnails and Replace buttons.
5. **E&O insurance**: carrier, policy number, expiration date, and an upload for the certificate (PDF or image).
6. **AML certification**: provider, completion date, and an upload for the certificate.
7. **Contracting (SureLC)**: a "Open SureLC" button (https://surelc.surancebay.com/sbweb/login.jsp), a note telling agents to finish contracting there, and a "Completed" checkbox with the date.
8. **Profile completion**: a percent bar at the top showing which items are still missing, like your screenshot.

Expiration dates within 30 days show a "Expiring soon" badge. Expired ones show a red "Expired" badge.

## Who can see it
- Each agent can see and edit only their own profile.
- Super admins can open any agent's Producer Profile from Admin → Users. SSNs and documents are visible only to the agent and super admins, not to managers, uplines, or trainers.
- Every time someone reveals an SSN or opens a document, it's recorded in the audit log.

## Technical details
- New `producer_profiles` table (1:1 with profiles): address, DOB, DL number/state/expiry, E&O carrier/policy/expiry, AML provider/date, SureLC completed_at, document storage paths. RLS: owner and super_admin only; GRANTs to authenticated/service_role.
- The SSN is encrypted server-side with the existing encryption helper used for Cal.com keys (AES-GCM, server secret). Only the last 4 digits are stored in plaintext for masking. Reveal goes through a server function that checks owner or super_admin and writes to the audit log.
- A private `producer-docs` storage bucket with paths `{user_id}/dl-front|dl-back|eo|aml.*` and storage RLS for the owner and super admins. Documents are viewed through short-lived signed URLs. Limit: 10MB, images and PDFs.
- Server functions go in `src/lib/producer-profile.functions.ts` with zod validation (SSN format, dates, file types). Shared validation goes in a browser-safe module with unit tests for SSN masking and expiry status.
- The existing Settings → Profile name, phone, NPN, and state fields move into this page, so you only type them once. Settings gets a "Producer Profile" section that replaces "Profile".
