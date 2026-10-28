# Release call uploads + agent-by-agent homework review

## 1. Release call: upload a recording anytime
- Once training unlocks, the Friday release day is always open. It no longer waits for Monday–Thursday approvals, and earlier days still unlock in order.
- Agents submit a release call the same way as homework: a Google Drive share link to the recording, plus an optional note. There's no separate "Request my release call" button.
- They can upload a new attempt whenever they want, even while one is waiting for review or after a "Not yet". Each attempt stays on their record.
- Every release recording is auto-graded by Call Coach on the full call (all pillars, including On Script). The score shows in the agent's training view and in your review.
- Passing still uses your "Passed — clear to call" button, which moves them to Cleared to Call / Active Agent as it does today.

## 2. Coach review: one agent at a time
New default view in Training Review:

```text
+--------------------+-------------------------------------------+
| Agents waiting     |  Justin Ortiz · Day 3 of 5 · 2 waiting      |
|  Justin  (2) •     |  Mon ✓  Tue ✓  Wed ● waiting  Thu –  Rel ●  |
|  Maria   (1)       |-------------------------------------------|
|  Devon   (rel)     |  [Wed homework]  player · AI score · fixes |
|                    |   attempts: #2 (now)  #1 sent back "..."   |
|                    |   feedback chips + note                    |
|                    |   [Approve]  [Send back]                   |
|                    |-------------------------------------------|
|                    |  [Release attempt #1] player · score ...   |
+--------------------+-------------------------------------------+
```

- **Left list:** every agent with work waiting, with counts and a badge when a release call is pending. Sorted by who has waited longest.
- **Agent panel:**
  - A Monday–Friday progress strip (approved / waiting / sent back / not started). Tap any day to see it.
  - Each waiting item shows the recording in the Vantage player, the AI score, pillar bars, the top 3 fixes, and a link to the full scorecard.
  - All past attempts for that day sit side by side with their score and your old feedback, so you can see whether they improved.
- **Actions:** Approve, Send back (feedback required) and Pass release stay as they are. After you act, the panel moves to that agent's next waiting item, or to the next agent.
- **Tabs:** "Cleared" stays as a tab. The "Ready for release" tab is folded into the agent list as a filter.
- **Mobile:** the agent list turns into a dropdown at the top.

## Technical details
- `training-homework.ts`: `validateHomeworkRecording` requires a Drive link for release days too. Update tests.
- `computeTrack`: a release day is `open` whenever training is unlocked (or `submitted`/`redo`/`approved` from its latest attempt). New attempts are allowed while one is pending. Add tests.
- `submitHomework`: create a Call Coach review for release submissions too, and keep setting `release_requested_at` and the log entry.
- New `getAgentTrainingReview({ profileId })` server function: the agent's days, all submissions (with signed URLs and call-review summaries) and progress, using the same leader access checks as `listTrainingReview`. `listTrainingReview` returns per-agent groups (waiting count, has release, oldest waiting).
- Rebuild `admin/training.tsx` into a two-pane agent view that reuses the existing ReviewCard/feedback chips. After a review, re-fetch and auto-select the next waiting item.
- No database changes.
