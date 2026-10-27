# Call playback on every Call Coach scorecard

## What you get
- A branded audio player at the top of each call's scorecard (dark/gold style): play/pause, scrub bar, current time / length, skip back 15s / forward 15s, and playback speed (1x, 1.25x, 1.5x, 2x).
- Works for both kinds of recordings:
  - Uploaded audio files: plays directly in the player.
  - Google Drive links (homework submissions): plays through an embedded Drive player, with an "Open in Drive" button as a backup if the file isn't shared publicly.
- Clickable transcript: each transcript line shows its timestamp; clicking it jumps the player to that moment, and the line being spoken is highlighted while playing (uploaded files).
- A small play button on each call in the Call Coach list and the leader review queue, opening the scorecard ready to play.

## Technical details
- `getReview` in `src/lib/coach.functions.ts`: also return `driveFileId` (parsed from `media_url`) and keep the signed URL for uploads; extend signed URL lifetime to 6h.
- New `src/components/coach/CallPlayer.tsx`: custom controls over a hidden `<audio>` for uploads; Drive fallback uses `https://drive.google.com/file/d/{id}/preview` iframe plus external link. Exposes `seek(seconds)` via ref.
- `src/routes/_authenticated/portal/coach.$id.tsx`: replace the bare `<audio>` with `CallPlayer`; render transcript segments (`transcript.segments[].start`) as seekable rows with active-line highlighting.
- List/queue rows link to the scorecard with a play icon; no database changes.
