import { BackLink } from "@/components/portal/back-link";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import {
  PageBody,
  Panel,
  Button,
  Badge,
  EmptyState,
  ErrorState,
  CardSkeleton,
} from "@/components/portal/ui";
import { getRecordingLearner } from "@/lib/academy-content.functions";
import { VantageMedia, type VantageMediaHandle } from "@/components/media/VantageMedia";
import { NotesPreview } from "@/components/vantage/academy/media-fields";
import { ChevronLeft } from "lucide-react";
import { useRef } from "react";

export const Route = createFileRoute("/_authenticated/portal/academy/presentations/$slug")({
  head: () => ({
    meta: [
      { title: "Recorded presentation — Vantage Academy" },
      { name: "description", content: "Watch a recorded Vantage training and review the AI training notes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecordingPage,
});

function RecordingPage() {
  const { slug } = Route.useParams();
  const getFn = useServerFn(getRecordingLearner);
  const q = useQuery({ queryKey: ["academy", "recording", slug], queryFn: () => getFn({ data: { slug } }) });

  const playerRef = useRef<VantageMediaHandle>(null);
  const seek = (ms: number) => playerRef.current?.seek(ms);

  if (q.isError)
    return (
      <PortalShell>
        <PageBody>
          <ErrorState description="We couldn't load this recording. Please try again." onRetry={() => q.refetch()} />
        </PageBody>
      </PortalShell>
    );

  if (q.isLoading)
    return (
      <PortalShell>
        <PageBody>
          <CardSkeleton lines={6} />
        </PageBody>
      </PortalShell>
    );

  const data = q.data && q.data.found ? q.data : null;
  if (!data)
    return (
      <PortalShell>
        <PageBody>
          <EmptyState
            title="Recording not found"
            description="This recording may be unpublished or the link is wrong."
            action={
              <Link to="/portal/academy" search={{ section: "presentations" }}>
                <Button variant="secondary" size="sm">Back to Academy</Button>
              </Link>
            }
          />
        </PageBody>
      </PortalShell>
    );

  const rec = data.recording as any;
  const transcript = data.transcript as any;

  return (
    <PortalShell>
      <PageBody>
        <BackLink
          to="/portal/academy"
          search={{ section: "presentations", speaker: rec.presenter?.slug ?? undefined }}
          className="p-focus mb-4 inline-flex items-center gap-1 text-[13px]"
          style={{ color: "var(--p-text-2)" }}
        >
          <ChevronLeft size={15} /> {rec.presenter?.name ?? "Recorded presentations"}
        </BackLink>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 space-y-4">
            <Panel>
              <VantageMedia
                ref={playerRef}
                url={rec.video_url}
                kind={rec.format === "audio" ? "audio" : "video"}
                title={rec.title}
                segments={transcript?.transcript_segments}
                fallbackText={transcript?.transcript_text}
                speakerNames={transcript?.speaker_names}
              />
            </Panel>

            <Panel
              title={rec.title}
              description={[rec.presenter?.name, rec.presenter_role || rec.presenter?.role].filter(Boolean).join(" · ")}
              actions={
                <div className="flex items-center gap-2">
                  {rec.topic && <Badge tone="blue">{rec.topic}</Badge>}
                  {rec.duration && <span className="p-muted">{rec.duration}</span>}
                </div>
              }
            >
              {rec.description ? (
                <p className="p-secondary whitespace-pre-wrap leading-relaxed">{rec.description}</p>
              ) : (
                <p className="p-muted">No description for this recording.</p>
              )}
            </Panel>
          </div>

          <Panel title="Training notes" padded={false}>
            <div className="p-4">
              {transcript?.notes ? (
                <NotesPreview notes={transcript.notes} onSeek={seek} />
              ) : (
                <p className="p-muted leading-snug">Training notes appear here once this recording has been transcribed.</p>
              )}
            </div>
          </Panel>
        </div>
      </PageBody>
    </PortalShell>
  );
}

