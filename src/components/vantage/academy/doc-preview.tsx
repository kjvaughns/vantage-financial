import { resolveDocument } from "@/lib/academy/media";
import { Button } from "@/components/portal/ui";
import { Overlay } from "@/components/vantage/resources/shared";
import { ExternalLink, Download } from "lucide-react";

/** Inline preview for documents, PDFs, images and Google Drive links. */
export function DocPreview({
  url,
  title,
  height = "h-[70vh]",
}: {
  url?: string | null;
  title?: string;
  height?: string;
}) {
  const doc = resolveDocument(url);

  if (!doc.embedUrl) {
    return (
      <div className="p-panel flex flex-col items-start gap-3 p-4">
        <p className="p-secondary leading-snug">{doc.blocker}</p>
        {doc.downloadUrl && (
          <a href={doc.downloadUrl} target="_blank" rel="noreferrer noopener">
            <Button variant="secondary" size="sm">
              <ExternalLink size={14} /> Open in new tab
            </Button>
          </a>
        )}
      </div>
    );
  }

  if (doc.kind === "image") {
    return (
      <div className="p-panel overflow-hidden">
        <img src={doc.embedUrl} alt={title ?? "Preview"} className="max-h-[70vh] w-full object-contain" />
      </div>
    );
  }

  return (
    <div className="p-panel overflow-hidden">
      <iframe
        src={doc.embedUrl}
        title={title ?? "Preview"}
        loading="lazy"
        allow="autoplay; fullscreen"
        allowFullScreen
        className={`w-full ${height}`}
        style={{ border: 0, background: "var(--p-raised)" }}
      />
    </div>
  );
}

/** Small row of open / download actions for a previewed document. */
export function DocPreviewActions({ url }: { url?: string | null }) {
  const doc = resolveDocument(url);
  if (!doc.downloadUrl) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <a href={doc.downloadUrl} target="_blank" rel="noreferrer noopener">
        <Button variant="secondary" size="sm">
          <ExternalLink size={14} /> Open in new tab
        </Button>
      </a>
      {(doc.kind === "pdf" || doc.kind === "image" || doc.kind === "office") && (
        <a href={doc.downloadUrl} download target="_blank" rel="noreferrer noopener">
          <Button variant="ghost" size="sm">
            <Download size={14} /> Download
          </Button>
        </a>
      )}
    </div>
  );
}

export function DocPreviewModal({
  url,
  title,
  onClose,
}: {
  url?: string | null;
  title?: string;
  onClose: () => void;
}) {
  return (
    <Overlay onClose={onClose}>
      <div className="p-panel relative p-4">
        <div className="flex items-start justify-between gap-3 pr-8">
          <h2 className="p-title truncate">{title ?? "Preview"}</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-focus absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-[14px] hover:bg-[var(--p-hover)]"
          style={{ color: "var(--p-text-2)" }}
        >
          ✕
        </button>
        <div className="mt-3 space-y-3">
          <DocPreview url={url} title={title} height="h-[65vh]" />
          <DocPreviewActions url={url} />
        </div>
      </div>
    </Overlay>
  );
}
