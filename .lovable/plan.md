# Forgot password for the agent portal

Agents who forget their password currently have no way to recover it — the login screen only offers email + password, and there is no reset screen. This adds a complete self-serve reset flow using the branded reset email that already exists.

## What agents will see

1. On the sign-in screen, a "Forgot password?" link next to the password field.
2. Clicking it swaps the card into a short "Reset your password" form: enter your email, press send.
3. Confirmation state: "If an account exists for that email, we've sent a reset link." (Same message either way, so the page never reveals who has an account.)
4. The emailed link opens a new "Choose a new password" page: new password + confirm, with a minimum length check. On success they're signed in and sent to the portal.
5. Clear error states for an expired or already-used link, with a one-click way to request a fresh one.

The reset email itself is already designed and live (gold Vantage branding, "Reset password" button) — no email changes needed.

## Technical notes

- `src/routes/login.tsx`: add a local mode toggle (`signin` | `forgot`) rendering the request form inside the existing card; calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${window.location.origin}/reset-password\` })`. Errors are not surfaced per-address (generic success message either way).
- New public route `src/routes/reset-password.tsx` (top-level, not under `_authenticated`, `robots: noindex`), styled with `PublicShell` + `vantage-card` to match login. It waits for the recovery session via `supabase.auth.onAuthStateChange` / `getSession()`, then calls `supabase.auth.updateUser({ password })` — no `current_password` on the recovery page — and navigates to `/portal`.
- If no recovery session is present (direct visit or expired link), show the invalid-link state with a link back to `/login`.
- Standard `head()` metadata on the new route.

No database, migration, or email-template changes are required.
