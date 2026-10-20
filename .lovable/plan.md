# Training Tab + Release Track (connected to the agent journey)

Goal: a dedicated Training area with a Monday–Thursday track, homework submissions you review, and a locked Release Course that leads to "Cleared to call" — all tied to the same applicant/agent record from application to producing agent.

## The progression

```text
Applicant -> Hired -> Account created -> Onboarding complete (includes Closer Course)
  -> Training unlocked -> Mon, Tue, Wed, Thu approved -> Release Course unlocked
  -> Release call passed -> Cleared to call (Active Agent)
```

## 1. Training tab (agents)
- New "Training" item in the portal menu. Locked screen until onboarding (with Closer Course) is complete, explaining what's left.
- Four day cards: Monday (Intro + Needs Analysis), Tuesday (+ Medical + Social), Wednesday (full presentation), Thursday (full + objections). Only the next day opens after the previous one is approved.
- Each day: your short video, the skill objective, the ChatGPT roleplay prompt with a one-click Copy button, simple voice-mode instructions, and a homework box.
- Homework submission: upload an audio/video recording or screen recording, or paste a ChatGPT share link, plus an optional note. Status shows Submitted / Needs redo / Approved, with your feedback visible.

## 2. Release Course
- Friday step, locked until all four days are approved.
- Short release-call prep (video + checklist) and a "Request my release call" button that notifies you.
- You record the result: Passed -> agent is marked Cleared to call and moved to Active Agent; Not yet -> feedback and they can request again.

## 3. Your review screen
- Admin "Training Review" queue: filters for Waiting on review, Ready for release, Cleared to call.
- Open a submission, play the recording, approve or send back with feedback. Agent gets an email and portal notice either way.

## 4. Manual control
- On the applicant/agent record: "Unlock training now" (skip the onboarding requirement), unlock or approve any single day, and mark release passed. Every override is logged with who did it.

## 5. Everything stays on one profile
- The applicant record gets a Training section: each day's status, submissions, feedback, reviewer, dates, release result.
- Timeline entries for: training unlocked, homework submitted, approved/sent back, release requested, release passed.
- Onboarding completion keeps moving the person to the Training stage; passing release moves them to Active Agent through the normal stage automations.

## 6. Editable content
- Admin "Training content" editor: for each day, the title, video, objective, prompt text and instructions. Days can be renamed or reordered later without code. Starts pre-filled with your four days and placeholder prompts (you paste your real prompt and videos).

## Technical details
- Migration: `training_days` (title, slug, sort, video url, objective, prompt, instructions, is_release, published), `training_submissions` (agent/applicant ids, day, file path or link, note, status, reviewer, feedback, timestamps), `training_progress` (per agent per day: unlocked/approved/override fields), plus `applicants.training_unlocked_at`, `training_unlock_override_by`, `release_passed_at`, `cleared_to_call_at`. GRANTs, RLS (agent sees own rows; upline/admin via existing visibility helpers; `can_manage_resources` edits content). Seed the four days + release literally in the migration.
- Private storage bucket `training-submissions` with owner-folder RLS; reviewers read via signed URLs.
- Server functions in `src/lib/training.functions.ts` (requireSupabaseAuth): getMyTraining, submitHomework, reviewSubmission, requestRelease, recordReleaseResult, overrideUnlock. Unlock rule computed server-side: onboarding_completed_at set OR override.
- Release pass calls `applyStage(..., "active-agent")` in `stage-engine.server.ts`; new emails (homework approved / needs redo / release requested / cleared to call) added to `src/lib/email/catalog.ts`.
- Routes: `portal/training.tsx`, `portal/admin/training.tsx` (review + content tabs); Training panel in `applicant-record.tsx`. UI from `@/components/portal/ui`.
- Add MCP read tool `get_training_status` for HyperAgent (caller-scoped).

## Verification
As agent: locked before onboarding, unlocked after; submit Monday, see Tuesday locked. As admin: approve, send back, override unlock, pass release; confirm the record timeline, stage change to Active Agent, and emails.

## Needs from you
Your roleplay prompt(s) and the four lesson videos (can be added after build in the content editor).
