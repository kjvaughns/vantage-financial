# Replace the Monday overview with 1:1 interview booking

## What applicants will see

On `/apply`, the "Which overview can you attend?" dropdown is replaced by a two-step picker:

1. **Pick a day** — a row of the next 7 days as tappable cards (e.g. "Tue · Sep 29"), showing how many open times each has. Days with no openings are greyed out.
2. **Pick a time** — once a day is chosen, its open times appear as a grid of gold-outlined pills in the applicant's own timezone (with Central time shown underneath). The picked time highlights solid gold and a small summary reads "Tue, Sep 29 at 2:30 PM — 1:1 call with Vantage".

All times come live from your 1:1 Calendly link, so only truly open slots are offered. It works nicely on phones (days scroll sideways, times wrap).

After submitting, the success page opens Calendly on that exact time with their name, email, phone and recruiter already filled in — one tap to confirm. That confirmation fires your existing webhook as it does today.

If Calendly can't be reached or there are no open times in the next 7 days, the picker is skipped and the success page just shows your 1:1 booking calendar, so applications are never blocked.

## Wording changes

- Success pages, next-step lists and applicant emails that say "Monday overview" now say "1:1 interview call".
- The Monday 7:00 PM Company Overview is removed from the team schedule shown in onboarding and emails.
- The weekly "join our company overview" campaign email is turned off (it can be re-enabled later).
- The landing-page video stays where it is — when your new VSL is ready, send me the link and I'll swap it in.

## Needs from you

- Your 1:1 Calendly link (e.g. `calendly.com/kjvaughns1/...`). If you don't send one, I'll use the non-overview event on your connected Calendly account.

## Technical notes

- `calendly.server.ts`: generalize `fetchOverviewSlots` into `fetchInterviewSlots` — pick the 1:1 event type by slug (from the admin setting URL), one 7-day `event_type_available_times` window, drop the Monday-only filter, return `{ startIso, dayKey, schedulingUrl }`.
- `calendly.functions.ts`: `getInterviewSlots` server fn; client groups by local day.
- New `src/components/vantage/interview-slot-picker.tsx` (day cards + time pills, design tokens only); replaces the overview `Field` in `apply.tsx`. Keeps storing the choice in `requested_overview_at` (no schema change); "none" path removed.
- `resolveBooking` / `get_overview_prefill`: build the prefilled URL from the 1:1 link with `kind: "one_on_one"` and the slot stamp.
- Admin setting `unlicensed_overview_calendly_url` relabelled "Applicant 1:1 interview Calendly URL" and set to the new link.
- Copy updates in `unlicensed.$token.tsx`, `licensed.$token.tsx`, `schedule.ts`, email catalog; disable the overview-invite campaign in `email-dispatch.ts`.
