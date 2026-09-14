# In-app preview for Academy files and Drive links

Right now, files and Google Drive links in the Academy open in a new browser tab. This adds an in-app preview so agents can view a document, PDF or Drive file without leaving the page.

## What changes for people using the portal

- Clicking a file/link resource in the Academy library opens a preview panel inside the portal showing the document itself.
- Google Drive files (docs, sheets, slides, PDFs, images) preview inline; uploaded PDFs and images preview inline too.
- Each preview keeps a small "Open in new tab" and "Download" option for anything that can't be shown inline (or when someone prefers the full app).
- Anything that genuinely can't be embedded (for example a plain website link, or a Drive file that isn't shared with "anyone with the link") shows a short plain-language note plus the open-in-new-tab button, instead of a blank frame.
- The Academy admin editor gets the same preview, so whoever adds a resource can confirm the link works before publishing.

## Technical detail

**1. `src/lib/academy/media.ts`** — add a document resolver alongside the existing `resolveMedia`:

- `resolveDocument(url)` returning `{ kind: "drive-doc" | "drive-file" | "pdf" | "image" | "office" | "web", embedUrl, downloadUrl, blocker }`.
- Drive: reuse `driveFileId`; Google Docs/Sheets/Slides URLs map to `/preview` (`docs.google.com/document/d/<id>/preview`, etc.), other Drive files to `https://drive.google.com/file/d/<id>/preview`.
- Direct `.pdf` / image extensions and Supabase storage object URLs embed directly.
- `.doc(x)/.xls(x)/.ppt(x)` use the Office web viewer with the encoded URL.
- Plain web links get `blocker` text (many sites refuse embedding) so the UI shows the note + open button.

**2. New `src/components/vantage/academy/doc-preview.tsx`**

- `<DocPreview url title />` — renders an iframe (`aspect`/`h-[70vh]`, `var(--p-raised)` background, sandboxed where possible) or the blocker note with actions.
- `<DocPreviewModal url title onClose />` — reuses the existing `Overlay` from `src/components/vantage/resources/shared.tsx` and the `Button` primitives from `@/components/portal/ui`.

**3. Wire it in (presentation only, no data/logic changes)**

- `src/routes/_authenticated/portal/academy/library.$slug.tsx`: replace the raw `<iframe src={r.url}>` for `type === "file"` with `<DocPreview>`, and give `type === "link"` a "Preview" button opening `DocPreviewModal` next to the existing "Open" link.
- `src/components/vantage/resources/library.tsx`: in `ItemModal`, render `DocPreview` when the item URL is previewable, keeping the existing CTA link as the secondary action.
- `src/components/vantage/academy/library-manager.tsx`: add a "Preview" button beside the URL field that opens `DocPreviewModal` for the current value.

No database, server function, or permission changes.
