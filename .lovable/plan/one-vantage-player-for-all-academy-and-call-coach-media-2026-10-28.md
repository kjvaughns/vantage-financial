# One Vantage player for all Academy and Call Coach media

## Goal
Academy recordings (presentations, course lessons, library items) and Call Coach calls all use the same fast Vantage player. The transcript sits right under the player in a fixed-height box and scrolls on its own to follow the recording.

## Why Academy calls load slowly
Academy audio and video saved as Google Drive, Loom, or other share links play inside that site's embedded viewer. Those viewers are slow and can't sync with the transcript reliably. Only direct or stored files play in a native player.

## What changes
1. **Universal Vantage player**: one player for audio and video. It has play/pause, a scrub bar, 15-second skip back and forward, speed (1x to 2x), time display, and full screen for video.
2. **Transcript under the player**: a fixed-height box, about 280px, that scrolls inside itself. The current line is highlighted and scrolls into view automatically. Clicking a line jumps the recording there. Auto-scroll pauses while you scroll by hand and resumes after a few seconds, or when you tap "Back to live."
3. **Faster loading for Academy media**: Drive-linked Academy audio and video are copied into Vantage storage the first time they're opened, the same way homework calls are now. Later plays stream straight from storage.
4. **YouTube and Vimeo**: these stay in their own embeds, because those sites don't allow copying. The transcript box still follows along using their time updates, which already exist today.
5. **Used everywhere**: course lessons, presentations, library items, Call Coach scorecards, and the Training Review page. The Call Coach transcript also moves under the player.

## Technical details
- New `src/components/media/VantagePlayer.tsx`: native `<audio>`/`<video>` with custom controls, with a fallback to the existing embed iframe for YouTube and Vimeo. It exposes a `seek(ms)` handle and an `onTime` callback.
- New `src/components/media/SyncedTranscript.tsx`: takes segments `{start,end,text,speaker}` and `currentMs`. Scroll is a fixed `h-[280px] overflow-y-auto` box. The active line is scrolled to `block:"nearest"` within the box only, so the page itself never jumps. A pause-on-user-scroll timer handles manual scrolling.
- Add `MediaWithTranscript` to wrap the player and transcript. Replace `AudioBlock`, the inline `<video>`/`<iframe>` in `courses.$slug`, `presentations.$slug` and `library.$slug`, the `TranscriptViewer` placement, and `CallPlayer` in `coach.$id` and admin training. `useMediaSeek` is reused for embeds.
- Add a server function `ensureAcademyMediaCached(url)`. It reuses the Drive import logic, extracted into a shared server helper, and stores files under an `academy-media` private bucket with signed URLs. A small cache table maps a source URL to its storage path, so each file is copied once. HTML or permission pages and files over about 200 MB fall back to the embed.
- The existing transcripts are unchanged; only where and how they're shown changes.
