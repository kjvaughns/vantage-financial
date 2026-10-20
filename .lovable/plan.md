# Vantage Training Hub + AI Call Coach

## Goal
Turn the Training tab into a polished **Vantage Training Hub** with two areas:
1. **My Training**: the existing Monday–Friday track, redesigned. Same rules and gates as today.
2. **Call Coach**: agents submit real or roleplay calls. AI transcribes each one, compares it to your script and model calls, and scores it.

## Training Hub redesign
- A header that shows the agent's current stage: Onboarding, Training Day X, Release, or Cleared to Call. It includes a progress bar and a "next action" button.
- Day cards for Monday through Friday. Each card shows locked, in progress, submitted, approved, or redo. Opening a day shows its video, goals, prompt, and homework.
- A Coach panel with the agent's average scores, latest call, weakest pillar, and an "Analyze a call" button.
- Same dark and gold style as the rest of the portal, laid out for mobile first.

## Call Coach
**Submitting a call:** agents either upload an audio file (mp3, m4a, or wav) or paste a Google Drive link that anyone with the link can open. Each call gets a title and a type (roleplay or live call).

**What happens next:**
1. AssemblyAI transcribes the call and separates the speakers, using the key Academy already uses.
2. AI scores the call against the "Gold Standard": your two Google Docs scripts plus model calls you mark as reference.
3. Each of 8 pillars gets a score from 1 to 10, with what went well, what to fix, and a better line to say from your script. The pillars are Intro, Needs Analysis, Medical, Social, Bank, Close, Rapport, and Tonality.
4. The call gets an overall score out of 100 (a weighted average of the pillars), a top-3 improvement list, and a timestamped transcript with each section labeled.

**Results page:** a radar or bar chart of the pillars, score cards you can expand, the transcript, and an audio player. Calls are listed by date, so agents can see whether they are improving.

**Who sees results:** the agent, their uplines, and admins. Leaders get a "Team Coaching" view with each agent's averages and latest calls, and they can leave comments.

## Gold Standard (admin)
- Admin > Training > Gold Standard.
- **Scripts:** import your two Google Docs and keep the text stored here, with a "Re-sync from Google Docs" button. Script sections line up with the 8 pillars, and you can edit each section.
- **Model calls:** upload your own recordings or pick them from Academy, then mark them as reference. Their transcripts become the examples of how each section should sound.
- **Scoring setup:** set each pillar's weight and add your own notes on what a 10 looks like.

## Optional connection to Training (off by default)
A setting to require a minimum Coach score before a day's homework can be approved. It is a suggestion for reviewers only; nothing gets auto-approved.

## What I need from you
- I'll connect Google Docs so I can import the two scripts. You'll approve that on a card.
- Upload 1 to 3 of your best calls as model calls after this is built.

## Technical details
- Tables: `coach_reference_scripts` (source doc id, sections jsonb), `coach_reference_calls` (applicant/academy media link, transcript, is_active), `coach_settings` (pillar weights and rubric notes), `call_reviews` (agent_id, source type, media path/url, status queued/transcribing/scoring/done/failed, transcript jsonb, pillar_scores jsonb, overall, summary, improvements), and `call_review_comments`. Every table gets GRANTs and RLS. Agents get their own reviews, uplines get their downline's through the existing hierarchy helper, and admins get everything through has_role.
- Uploads go to a private `call-recordings` storage bucket. A signed URL is passed to AssemblyAI. Drive links reuse `assertMediaReachable`.
- `src/lib/coach.server.ts` reuses the AssemblyAI helper in `src/lib/academy/transcribe.server.ts` (speaker labels on). Scoring runs on the Lovable AI Gateway with structured tool-call output that is validated with zod. The prompt includes the matching script sections and short excerpts from the reference transcripts.
- `src/lib/coach.functions.ts` holds authenticated server functions: submit, poll status, list, get, comment, and admin gold-standard CRUD/sync. Processing runs step by step as the client polls, which avoids long requests on the worker.
- Pure helpers for computing the overall score and checking pillar output live in `src/lib/coach-scoring.ts`, with vitest tests for the weighted average and the 1–10 limits.
- Routes: `/portal/training` (redesigned hub), `/portal/training/coach`, `/portal/training/coach/$id`, `/portal/training/team`, and `/portal/admin/gold-standard`.
- The Google Docs connector is used for script import only, on the server.
- Add an AGENTS.md rule: coach scoring always uses the stored Gold Standard as its single source of truth.
