# Fast call playback: store homework recordings in Vantage

## Why it's slow today
Uploaded calls already play from our own storage with the Vantage player. Homework calls submitted as Google Drive links play inside Google's embedded Drive viewer, which loads slowly, sometimes asks for sign-in, and can't jump to transcript timestamps.

## What changes
1. **Copy the recording when homework is submitted.** When an agent submits a Drive link, the backend downloads the audio once (using the same download link the AI analysis already uses) and saves it to the private call-recordings storage.
2. **Every call uses the Vantage player.** Play/pause, scrub, 15s skip, speed, and clickable transcript timestamps work for homework calls too. Playback starts quickly and streams from our storage.
3. **Fix older calls.** A one-time "Import recording" action (automatic on first open of a scorecard) copies existing Drive-based recordings into storage.
4. **Fallback.** If a Drive file isn't shared as "Anyone with the link" or is too large, the current Drive player and "Open in Drive" button remain, with a short note explaining why.

## Technical details
- In `src/lib/coach.functions.ts`, add a step that streams the Drive `uc?export=download` response into `call-recordings/{user_id}/{review_id}.{ext}` and sets `call_reviews.media_path`; triggered from the homework submit path in `src/lib/training.functions.ts` and lazily from the review detail loader for existing rows.
- Skip HTML responses (Drive's virus-scan/permission page) and enforce a size cap (~100 MB) to stay within worker limits.
- Review detail already prefers a signed `media_path` URL, so `CallPlayer` switches automatically; use `preload="metadata"` (already set) for fast start.
- No new table; existing bucket and RLS reused.
