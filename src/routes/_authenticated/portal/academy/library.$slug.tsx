import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageBody, Panel, Button, Badge, EmptyState, ErrorState, CardSkeleton } from "@/components/portal/ui";
import { getLibraryResource } from "@/lib/academy.functions";
import { ChevronLeft, Video, Headphones, FileText, Link2, Download, ExternalLink } from "lucide-react";
import { resolveMedia, isPreviewableDocument } from "@/lib/academy/media";
import { AudioBlock } from "@/components/vantage/academy/audio-block";
import { DocPreview, DocPreviewModal } from "@/components/vantage/academy/doc-preview";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/portal/academy/library/$slug")({
  head: () => ({ meta: [{ title: "Resource — Vantage Academy" }, { name: "robots", content: "noindex" }] }),
  component: ResourceDetail,
});

type ResType = "video" | "audio" | "file" | "link";
const TYPE_ICON: Record<ResType, typeof Video> = { video: Video, audio: Headphones, file: FileText, link: Link2 };

function ResourceDetail() {
  const { slug } = Route.useParams();
  const getFn = useServerFn(getLibraryResource);
  const q = useQuery({ queryKey: ["academy", "resource", slug], queryFn: () => getFn({ data: { slug } }) });

  if (q.isError) {
    return (
      <PortalShell>
        <PageBody>
          <ErrorState description="We couldn't load this resource right now. Please try again." onRetry={() => q.refetch()} />
        </PageBody>
      </PortalShell>
    );
  }

  if (q.isLoading) {
    return (
      <PortalShell>
        <PageBody>
          <div className="mx-auto max-w-3xl">
            <CardSkeleton lines={6} />
          </div>
        </PageBody>
      </PortalShell>
    );
  }
  if (!q.data?.found) {
    return (
      <PortalShell>
        <PageBody>
          <EmptyState title="Resource not found" description="This resource may have been removed." action={<Link to="/portal/academy"><Button variant="secondary" size="sm">Back to Academy</Button></Link>} />
        </PageBody>
      </PortalShell>
    );
  }

  const r = q.data.resource as any;
  const Icon = TYPE_ICON[(r.type as ResType) in TYPE_ICON ? (r.type as ResType) : "link"];

  return (
    <PortalShell>
      <PageBody>
        <Link to="/portal/academy" className="p-focus mb-4 inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--p-text-2)" }}>
          <ChevronLeft size={15} /> Academy
        </Link>

        <div className="mx-auto max-w-3xl space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px]" style={{ background: "var(--p-raised)", color: "var(--p-gold)" }}><Icon size={18} /></span>
              <div className="min-w-0">
                <h1 className="p-title truncate">{r.title}</h1>
                <div className="p-muted mt-0.5 capitalize">{r.type}</div>
              </div>
            </div>
            {r.is_required && <Badge tone="gold" className="shrink-0">Required</Badge>}
          </div>

          {r.type === "video" && (
            <div className="p-panel overflow-hidden">
              {!r.url ? (
                <div className="grid aspect-video place-items-center" style={{ background: "var(--p-raised)", color: "var(--p-text-3)" }}>No media</div>
              ) : resolveMedia(r.url).embedUrl ? (
                <iframe src={resolveMedia(r.url).embedUrl!} title={r.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className="aspect-video w-full" style={{ border: 0, background: "var(--p-raised)" }} />
              ) : (
                <video controls src={r.url} className="aspect-video w-full" style={{ background: "var(--p-raised)" }} />
              )}
            </div>
          )}
          {r.type === "audio" && (
            <Panel><AudioBlock url={r.url} title={r.title} /></Panel>
          )}

          {r.type === "file" && (
            <Panel
              title="File"
              actions={
                r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer noopener">
                    <Button variant="primary" size="sm"><Download size={14} /> Download</Button>
                  </a>
                )
              }
            >
              {r.url ? (
                <DocPreview url={r.url} title={r.title} height="h-[65vh]" />
              ) : (
                <div className="p-muted">No file attached.</div>
              )}
            </Panel>
          )}
          {r.type === "link" && (
            <Panel>
              {r.description && <p className="p-secondary mb-3">{r.description}</p>}
              {r.url && isPreviewableDocument(r.url) && (
                <div className="mb-3">
                  <DocPreview url={r.url} title={r.title} height="h-[60vh]" />
                </div>
              )}
              {r.url && (
                <div className="flex flex-wrap gap-2">
                  {!isPreviewableDocument(r.url) && (
                    <Button variant="secondary" size="sm" onClick={() => setPreview(true)}>
                      Preview
                    </Button>
                  )}
                  <a href={r.url} target="_blank" rel="noreferrer noopener">
                    <Button variant="primary" size="sm"><ExternalLink size={14} /> Open</Button>
                  </a>
                </div>
              )}
            </Panel>
          )}
          {preview && <DocPreviewModal url={r.url} title={r.title} onClose={() => setPreview(false)} />}

          {r.type !== "link" && r.description && <p className="p-secondary leading-relaxed">{r.description}</p>}

          {(r.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(r.tags ?? []).map((t: string) => <Badge key={t} tone="neutral">{t}</Badge>)}
            </div>
          )}
        </div>
      </PageBody>
    </PortalShell>
  );
}
