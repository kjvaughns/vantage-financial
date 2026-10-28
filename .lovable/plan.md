# Training Hub video player + smarter homework grader

## 1. Training day lesson videos use the Vantage player
Today each Training day lesson shows a plain embedded frame (or just a link). Replace it with the shared Vantage player so Drive/uploaded lesson videos load from app storage, show speed/seek controls, and collapse to audio-only when needed. YouTube/Vimeo stay embedded inside the same player shell.

## 2. Grade only what the agent actually did
The grader currently forces a 1–10 score on all eight pillars, so a medical + bank-only roleplay gets punished for "missing" intro and needs analysis.

New behavior:
- Before scoring, the AI first maps the transcript to script sections and marks each pillar as **performed**, **partial**, or **not attempted**, citing the transcript lines it used.
- Not-attempted pillars get no score and are left out of the overall (weights re-balance across what was done). Rapport and tonality are scored whenever any section was performed.
- Homework is graded against the day's expected sections (Mon: Intro + Needs Analysis; Tue: + Medical + Social; Wed: full; Thu: full + objections). If something the day requires is missing, it shows a "Missing from today's homework" note instead of a low score.
- Each pillar compares only to the matching part of the Gold Standard script and model calls, so advice is specific to that section.
- Scorecard, Call Coach list, and reviewer queue show not-attempted pillars as "Not attempted" (gray), and averages ignore them.
- Re-analyze uses the new engine, so older reviews can be re-scored.

## Technical details
- `training.tsx` DayBody: swap iframe for `VantageMedia`.
- `coach-scoring.ts`: `PillarScore` gets `status: "performed"|"partial"|"not_attempted"` and nullable `score`; `overallScore` skips not-attempted; normalize old rows as performed. Update tests.
- `coach.server.ts` `scoreCall`: two-stage prompt (section detection with evidence, then scoring only detected sections), accept optional `expectedPillars` from the training day; homework reviews pass the day's expected sections (stored on training days, defaulting by day number).
- `coach.functions.ts` averages and weakest-pillar logic ignore not-attempted; scorecard/queue UI render the new status.
