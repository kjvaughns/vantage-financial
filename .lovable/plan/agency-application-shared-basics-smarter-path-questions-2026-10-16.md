# Agency application: shared basics + smarter path questions

## What the form does today
- **Builder** asks: number of downlines, monthly team production, and what they're looking for (leads, systems, training, leadership, compensation, other).
- **Owner** asks: agency name, number of active writers, biggest bottleneck, and what they need help with. It does **not** ask about monthly production, and it says "writers" instead of downlines.

## Change 1 — Both paths ask the same two basics
- "How many downlines / agents currently write under you?" (minimum 1) for both paths.
- "Current monthly team production" using the same gold dropdown for both paths.
- Owner keeps agency name, bottleneck, and help needed.

## Change 2 — Extra questions that help you qualify each path
Kept short: mostly tap-to-pick, so the form stays quick. All shown in the portal, your alert email, Discord, and the call notes.

**Builder (grow under Vantage)**
- How many of your downlines are licensed and actively writing each month? (dropdown)
- Who are you contracted with today? (IMO/agency name)
- Is your team under a non-compete or release requirement? (Yes / No / Not sure)
- What are your agents spending on leads per month? (dropdown) — shows the value of you covering leads
- Products your team writes mostly (multi-select: Final Expense, Mortgage Protection, Veteran, IUL/Annuity, Other)
- How soon could you move your team? (Now / 30 days / 60-90 days / Just exploring)

**Owner (power your agency with InsuraCloud)**
- Years in business (dropdown)
- Current IMO / upline you contract through
- Number of carrier contracts you hold today (dropdown)
- Do you want to stay branded as your own agency? and do you want to grow into an IMO with agencies under you? (Yes/No each)
- Tools you use today (multi-select: CRM, dialer, contracting tool, leaderboard, commission tracking, none)
- Timeline to switch (Now / 30 days / 60-90 days / Just exploring)

## Change 3 — Path Finder prefill
Path Finder answers (team size, production) will prefill these for both paths.

## Technical details
- One additive migration with new nullable applicant columns (active writers, current IMO reuse of existing `current_imo`, release status, lead spend, products, timeline, years in business, carrier count, wants branding, wants IMO, current tools).
- Owner schema: `monthly_production` becomes required like Builder; `team_size` relabelled as downlines.
- Extend validation, saving, CRM Agency panel, recruiter email, Discord and Cal.com notes.
- Verify: typecheck, browser check both paths' conditional fields and required checks, no live booking.

## Your call
Tell me if you want to drop or add any of the Change 2 questions before I build.
