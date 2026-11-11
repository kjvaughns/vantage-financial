# Academy Manager Redesign + Automatic Transcription

## Goal
Make adding presentations, resources, and courses obvious and fast, and remove the need to ever press "Transcribe".

## 1. Quick-Add button (everywhere in Academy)
- A gold "+ Add to Academy" button on the Academy home and Manage Academy screens (admins only).
- Opens a simple picker with 3 large visual cards:
  - **Presentation / Call recording** — paste a link, title, speaker.
  - **Resource** — document, link, or file for the library.
  - **Course** — name + description, then jumps straight into the course builder.
- Each card opens one short form (no tabs). Publish or Save as draft at the bottom.

## 2. Simpler Manage Academy screen
- Replace the 5-tab control with one list of all content, filter chips (All, Presentations, Resources, Courses, Drafts) and search.
- Each row shows type, status (Draft / Published / Transcribing / Ready), and quick Edit / Publish / Delete actions.
- Templates move into a small "More" menu.

## 3. Easier presenter selection
- Speaker picker inline in the presentation form: search existing presenters or type a new name to create one on the spot.

## 4. Inline course builder
- One outline page: modules listed top to bottom, "+ Add module" and "+ Add lesson" right where you need them.
- Lesson editor beside the outline: video link, notes, reference links, with a live preview using the Vantage player.
- Drag to reorder modules and lessons.

## 5. Automatic transcription
- Saving or publishing any recording/lesson with a Google Drive, MP3, MP4, or uploaded file link automatically starts transcription.
- Changing the link restarts it; YouTube/Vimeo show "Uses native captions" instead.
- Status pill next to the link field and in the content list: Transcribing… → Ready (or Failed with Retry).
- Transcripts and AI notes appear automatically when finished; the manager list keeps checking status in the background while open.
- The manual button becomes "Re-transcribe" inside an advanced menu only.

## Technical details
- Reuse `requestTranscription` / `syncTranscription` in `src/lib/academy-media.functions.ts`; call request from the save/publish server functions when the media URL is new or changed and transcribable (shared helper in `src/lib/academy/media.ts`).
- Add a polling hook (like `useReviewPolling`) on the Manage Academy list and editors for items in transcribing state.
- Rebuild `src/routes/_authenticated/portal/academy/admin.tsx` into list + Quick-Add dialog; split forms into components under `src/components/academy/`.
- Keep permissions as today (admin-only writes, RLS-scoped reads). All media keeps using `VantageMedia`.
- Add tests for the "is transcribable / should auto-transcribe" rule.
