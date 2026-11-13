# Dialer Support in the Portal

## What agents get
A new **Dialer** page in the portal where an agent can:
- Request a dialer login. Their first and last name come from their profile and can be edited.
- Pick lead types: FEX, VETS, MP. They can pick more than one.
- Pick their states, and add or remove states later.
- See their request status and, once support fills it in, their dialer username and password.

## How the sheet stays connected (two-way sync)
- When an agent submits or changes a request, the portal adds or updates that agent's row in your dialer Google Sheet (Sheet1): Agent Name, Lead Types, States.
- Justin fills in Dialer Username and Dialer Password in the sheet as usual.
- The portal reads the sheet every few minutes and whenever the agent opens the Dialer page, so the new login shows up automatically.
- Lead types and states are written in the same short format your sheet's dropdowns use (FEX/VETS/MP, state abbreviations).

## Daily email
- Every day at 8 AM Central, justin@harborstonefinancialgroup.com gets one email listing every new or changed dialer request from the previous day: agent name, lead types, states, and whether it's new or an update.
- No email is sent on days with no requests.

## Admin view
- Admins see a simple list of all dialer requests and their status, with a link to open the sheet.

## Technical details
- Link the existing Google Sheets connection to the project. All calls happen on the server through the connector gateway, and values are written with USER_ENTERED.
- New table `dialer_requests` with these fields: user_id, agent_name, lead_types text[], states text[], sheet_row, status (requested, active), dialer_username, dialer_password_present, last_synced_at, and timestamps. RLS lets agents read and write only their own row. Admins can read every row. Grants are included.
- The dialer password stays in the sheet. When the owning agent opens the page, the server fetches it from the sheet, so it is never stored in the database.
- Writes find the agent's row by matching the stored sheet_row and the name. A new request is appended and its row number is saved.
- Sync job: pg_cron runs every 10 minutes and calls `/api/public/dialer/sync`, which is protected by a shared secret. Reads are batched to stay within Sheets limits.
- Daily digest: pg_cron runs at 13:00 UTC (8 AM CST; this becomes 7 AM during daylight saving time unless the schedule is adjusted) and calls `/api/public/dialer/digest`, which is also secret-protected. It sends one app email, `dialer-daily-digest`, to Justin through the existing email setup, with an idempotency key based on the date.
- Add a sidebar entry and a page at `/portal/dialer`. The admin list lives at `/portal/admin/dialer`.
- Add tests for lead-type and state formatting and for the digest's previous-day window.
