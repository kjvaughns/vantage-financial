# Connect HyperAgent to Vantage (MCP server)

## What you get
A secure connection address (`https://vantage-financial.net/mcp`) you paste into HyperAgent. HyperAgent signs in with your Vantage account (one-time approval screen), then can act with exactly your permissions — nothing more.

## Tools HyperAgent will have
Applicants
- Search/list applicants (filter by stage, type Agent/Builder/Owner, referred by, licensed, date)
- Get one applicant's full profile: answers, stage, scheduled call, notes, activity
- Create an applicant
- Change an applicant's stage (runs the normal stage automations and emails)
- Add a note / update basic fields (phone, email, state, tags)
- Mark course purchase confirmed

Agents and team
- List agents and their onboarding progress
- See the pipeline summary (counts per stage) and today's/upcoming interviews

Events ("what's new")
- Get recent activity since a given time: new applications, bookings, reschedules, cancellations, stage changes. HyperAgent can check this on a schedule to react to new events.

## What it will not do
No deleting applicants, no changing roles or admin settings, no sending arbitrary emails.

## After it's built
You publish the app, then add the address in HyperAgent's MCP settings and approve the sign-in.

## Technical details
- `@lovable.dev/mcp-js` with TanStack Vite plugin, mounted at `/mcp`; server `name: "vantage-financial"`, `title: "Vantage Financial"`.
- Auth: Supabase OAuth 2.1 (activate via configure_oauth_server), consent page route per app-mcp-consent-tanstack, caller-scoped Supabase client so existing RLS and role checks apply.
- One tool per file in `src/lib/mcp/tools/`, registered in `src/lib/mcp/index.ts`; stage changes reuse the stage engine; inputs validated with Zod; annotations set (read-only vs. mutating).
- Events tool reads the existing applicant activity log with a `since` cursor.
- Run manifest extraction after changes.
