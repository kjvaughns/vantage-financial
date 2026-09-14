import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  ListSkeleton,
  Field,
  Radio,
  notify,
} from "@/components/portal/ui";
import { getCourseLearner, markLessonComplete, submitQuiz } from "@/lib/academy.functions";
import { resolveMedia, isPreviewableDocument } from "@/lib/academy/media";
import { DocPreview } from "@/components/vantage/academy/doc-preview";

import { AudioBlock } from "@/components/vantage/academy/audio-block";
import { NotesPreview } from "@/components/vantage/academy/media-fields";
import { TranscriptViewer, useMediaSeek } from "@/components/vantage/academy/transcript-viewer";
import { ChevronLeft, CheckCircle2, Circle, Lock, HelpCircle, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/academy/courses/$slug")({
  head: () => ({ meta: [{ title: "Course — Vantage Academy" }, { name: "robots", content: "noindex" }] }),
  component: CoursePlayer,
});

type Prog = { lesson_id: string; completed_at: string | null; quiz_score: number | null };

function CoursePlayer() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getCourseLearner);
  const q = useQuery({ queryKey: ["academy", "learn", slug], queryFn: () => getFn({ data: { slug } }) });

  const [selected, setSelected] = useState<string | null>(null);
  const [openModules, setOpenModules] = useState<string[] | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);

  const data = q.data && q.data.found ? q.data : null;

  const ordered = useMemo(() => {
    if (!data) return [];
    const progMap: Record<string, Prog> = {};
    for (const p of data.progress as Prog[]) progMap[p.lesson_id] = p;
    const rows: { moduleId: string; lesson: any; completed: boolean; locked: boolean }[] = [];
    let blocked = false;
    for (const m of data.modules as any[]) {
      const modLessons = (data.lessons as any[]).filter((l) => l.module_id === m.id);
      for (const l of modLessons) {
        const completed = !!progMap[l.id]?.completed_at;
        rows.push({ moduleId: m.id, lesson: l, completed, locked: blocked });
        if (l.kind === "quiz" && !completed) blocked = true;
      }
    }
    return rows;
  }, [data]);

  const done = ordered.filter((r) => r.completed).length;
  const total = ordered.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const firstOpen = ordered.find((r) => !r.completed && !r.locked)?.lesson.id ?? ordered[0]?.lesson.id ?? null;
  const currentId = selected ?? firstOpen;
  const current = ordered.find((r) => r.lesson.id === currentId);
  const modulesOpen = openModules ?? (data ? (data.modules as any[]).map((m) => m.id) : []);

  if (q.isError) {
    return (
      <PortalShell>
        <PageBody>
          <ErrorState description="We couldn't load this course right now. Please try again." onRetry={() => q.refetch()} />
        </PageBody>
      </PortalShell>
    );
  }

  if (q.isLoading) {
    return (
      <PortalShell>
        <PageBody>
          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
            <div className="p-panel p-4"><ListSkeleton rows={5} /></div>
            <CardSkeleton lines={5} />
          </div>
        </PageBody>
      </PortalShell>
    );
  }
  if (!data) {
    return (
      <PortalShell>
        <PageBody>
          <EmptyState title="Course not found" description="This course may be unpublished or the link is wrong." action={<Link to="/portal/academy"><Button variant="secondary" size="sm">Back to Academy</Button></Link>} />
        </PageBody>
      </PortalShell>
    );
  }

  const completedCourse = !!(data.enrollment as any)?.completed_at;

  return (
    <PortalShell>
      <PageBody>
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <Link to="/portal/academy" className="p-focus inline-flex min-w-0 items-center gap-1 text-[13px]" style={{ color: "var(--p-text-2)" }}>
            <ChevronLeft size={15} className="shrink-0" /> <span className="truncate">Academy</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: "var(--p-hover)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, background: "var(--p-gold)" }} />
            </div>
            <span className="p-muted whitespace-nowrap">{pct}% · {done}/{total}</span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
          {/* Outline */}
          <Panel padded={false} className="overflow-hidden">
            {/* On mobile this header toggles the outline so the lesson shows first; static rail on lg+. */}
            <button
              onClick={() => setOutlineOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 border-b px-4 py-3 text-left lg:cursor-default"
              style={{ borderColor: "var(--p-border)" }}
            >
              <div className="min-w-0">
                <div className="p-section-title truncate">{(data.course as any).title}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="p-muted text-[12px] lg:hidden">Contents · {done} of {total}</span>
                  {(data.course as any).is_required && <Badge tone="gold">Required</Badge>}
                </div>
              </div>
              <span className="shrink-0 text-[13px] lg:hidden" style={{ color: "var(--p-text-3)" }}>
                {outlineOpen ? "▾" : "▸"}
              </span>
            </button>
            <div className={`max-h-[70vh] overflow-y-auto p-2 lg:block ${outlineOpen ? "block" : "hidden"}`}>
              {(data.modules as any[]).map((m) => {
                const open = modulesOpen.includes(m.id);
                const rows = ordered.filter((r) => r.moduleId === m.id);
                return (
                  <div key={m.id} className="mb-1">
                    <button
                      onClick={() => setOpenModules((cur) => { const base = cur ?? (data.modules as any[]).map((x) => x.id); return base.includes(m.id) ? base.filter((x) => x !== m.id) : [...base, m.id]; })}
                      className="p-focus flex w-full items-center justify-between rounded-[8px] px-2 py-2 text-left"
                    >
                      <span className="text-[12.5px] font-semibold uppercase tracking-[0.05em]" style={{ color: "var(--p-text-3)" }}>{m.title}</span>
                      <span style={{ color: "var(--p-text-3)" }}>{open ? "−" : "+"}</span>
                    </button>
                    {open && rows.map(({ lesson: l, completed, locked }) => (
                      <button
                        key={l.id}
                        disabled={locked}
                        onClick={() => { setSelected(l.id); setOutlineOpen(false); }}
                        className="p-focus flex min-h-11 w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left text-[13.5px] transition disabled:cursor-not-allowed"
                        style={{
                          background: currentId === l.id ? "var(--p-gold-soft)" : "transparent",
                          color: locked ? "var(--p-text-3)" : currentId === l.id ? "var(--p-gold)" : "var(--p-text)",
                          opacity: locked ? 0.55 : 1,
                        }}
                      >
                        {locked ? <Lock size={15} /> : completed ? <CheckCircle2 size={15} style={{ color: "var(--p-green)" }} /> : l.kind === "quiz" ? <HelpCircle size={15} style={{ color: "var(--p-amber)" }} /> : <Circle size={15} />}
                        <span className="min-w-0 flex-1 truncate">{l.title}</span>
                        {l.kind === "quiz" && <Badge tone="amber">Quiz</Badge>}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Main */}
          <div className="min-w-0 space-y-4">
            {completedCourse && (
              <Panel className="text-center">
                <div className="flex flex-col items-center gap-2 py-4">
                  <div className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "var(--p-gold-soft)", color: "var(--p-gold)" }}>
                    <Trophy size={22} />
                  </div>
                  <div className="p-card-title">Course complete</div>
                  <p className="p-secondary max-w-sm">
                    You've finished {(data.course as any).title}.
                    {(data.enrollment as any)?.final_score != null && ` Final score: ${Math.round((data.enrollment as any).final_score * 100)}%.`}
                  </p>
                </div>
              </Panel>
            )}

            {current?.locked ? (
              <Panel><EmptyState icon={<Lock size={16} />} title="Locked" description="Pass the quiz before this to unlock this lesson." /></Panel>
            ) : current?.lesson.kind === "quiz" ? (
              <QuizView
                lesson={current.lesson}
                questions={(data.questions as any[]).filter((qq) => qq.lesson_id === current.lesson.id)}
                onDone={() => qc.invalidateQueries({ queryKey: ["academy", "learn", slug] })}
              />
            ) : current ? (
              <LessonView
                lesson={current.lesson}
                transcript={((data as any).transcripts ?? []).find((t: any) => t.owner_id === current.lesson.id) ?? null}
                completed={current.completed}
                onComplete={() => qc.invalidateQueries({ queryKey: ["academy", "learn", slug] })}
              />

            ) : (
              <Panel><EmptyState title="No lessons yet" description="This course has no content yet." /></Panel>
            )}
          </div>
        </div>
      </PageBody>
    </PortalShell>
  );
}

function LessonView({
  lesson,
  transcript,
  completed,
  onComplete,
}: {
  lesson: any;
  transcript: any;
  completed: boolean;
  onComplete: () => void;
}) {
  const markFn = useServerFn(markLessonComplete);
  const mut = useMutation({
    mutationFn: () => markFn({ data: { lesson_id: lesson.id } }),
    onSuccess: () => { notify.success("Lesson complete."); onComplete(); },
    onError: () => notify.error("Couldn't mark this lesson complete. Please try again."),
  });
  const kind = lesson.kind === "lesson" ? (lesson.media_type ?? "video") : lesson.kind;
  const media = resolveMedia(lesson.video_url);
  const nativeRef = useRef<HTMLMediaElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const isNative = (kind === "audio" && !media.embedUrl) || (kind === "video" && media.kind === "direct");
  const target = isNative
    ? ({ kind: "element", ref: nativeRef } as const)
    : media.kind === "youtube"
      ? ({ kind: "youtube", ref: frameRef } as const)
      : media.kind === "vimeo"
        ? ({ kind: "vimeo", ref: frameRef } as const)
        : ({ kind: "none" } as const);
  const { seek, canSeek, currentMs } = useMediaSeek(target);

  return (
    <>
      {kind === "audio" && (
        <Panel>
          <AudioBlock
            url={lesson.video_url}
            title={lesson.title}
            nativeRef={nativeRef as React.Ref<HTMLAudioElement>}
            frameRef={frameRef}
          />
        </Panel>
      )}


      {kind === "video" && (
        <div className="p-panel overflow-hidden">
          {!lesson.video_url ? (
            <div className="grid aspect-video w-full place-items-center" style={{ background: "var(--p-raised)", color: "var(--p-text-3)" }}>
              No media attached
            </div>
          ) : media.kind === "direct" ? (
            <video
              ref={nativeRef as React.RefObject<HTMLVideoElement>}
              controls
              src={lesson.video_url}
              className="aspect-video w-full"
              style={{ background: "var(--p-raised)" }}
            />
          ) : (
            <iframe
              ref={frameRef}
              src={media.embedUrl ?? lesson.video_url}
              title={lesson.title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="aspect-video w-full"
              style={{ border: 0, background: "var(--p-raised)" }}
            />
          )}
        </div>
      )}

      <Panel title={lesson.title} description={lesson.duration || undefined}>
        {kind === "text" && lesson.body && (
          <p className="p-secondary whitespace-pre-wrap leading-relaxed">{lesson.body}</p>
        )}
        {lesson.blurb && <p className="p-secondary mt-2 whitespace-pre-wrap leading-relaxed">{lesson.blurb}</p>}
        {(kind === "resource" || kind === "link") && lesson.resource_url && (
          <div className="mt-3 space-y-3">
            {isPreviewableDocument(lesson.resource_url) && (
              <DocPreview url={lesson.resource_url} title={lesson.title} height="h-[60vh]" />
            )}
            <a href={lesson.resource_url} target="_blank" rel="noreferrer" className="inline-block">
              <Button variant="secondary" size="sm">
                {lesson.resource_label || (kind === "link" ? "Open link" : "Open resource")} →
              </Button>
            </a>
          </div>
        )}

        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={() => mut.mutate()} disabled={completed} loading={mut.isPending}>
            {completed ? "✓ Completed" : "Mark complete"}
          </Button>
        </div>
      </Panel>

      {(transcript?.notes || transcript?.transcript_text) && (
        <Panel title="Training notes" description="Generated from this lesson's recording.">
          {transcript?.notes && <NotesPreview notes={transcript.notes} onSeek={canSeek ? seek : undefined} />}
          {(transcript?.transcript_text || transcript?.transcript_segments) && (
            <details className="mt-3">
              <summary className="p-focus cursor-pointer text-[13px]" style={{ color: "var(--p-text-2)" }}>
                Read the full transcript
              </summary>
              <div className="mt-2">
                <TranscriptViewer
                  segments={transcript?.transcript_segments}
                  fallbackText={transcript?.transcript_text}
                  speakerNames={transcript?.speaker_names}
                  onSeek={seek}
                  canSeek={canSeek}
                  currentMs={currentMs}
                  maxHeight={320}
                />
              </div>
            </details>
          )}
        </Panel>
      )}
    </>
  );
}

type QuizResult = {
  passed: boolean;
  score: number;
  threshold: number;
  results?: { id: string; correct: boolean; correct_index: number; explanation: string | null }[];
};

function QuizView({ lesson, questions, onDone }: { lesson: any; questions: any[]; onDone: () => void }) {
  const submitFn = useServerFn(submitQuiz);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const mut = useMutation({
    mutationFn: () => submitFn({ data: { lesson_id: lesson.id, answers: questions.map((_, i) => answers[i] ?? -1) } }),
    onSuccess: (res) => {
      setResult(res as QuizResult);
      onDone();
      if (res.passed) notify.success("Passed! Next lesson unlocked.");
    },
    onError: () => notify.error("Couldn't submit your quiz. Please try again."),
  });

  const allAnswered = questions.length > 0 && questions.every((_, i) => answers[i] != null);
  const byId: Record<string, NonNullable<QuizResult["results"]>[number]> = {};
  for (const r of result?.results ?? []) byId[r.id] = r;

  return (
    <Panel title={lesson.title} description={`Pass at ${Math.round((lesson.quiz_pass_threshold ?? 0.75) * 100)}%`}>
      {questions.length === 0 ? (
        <p className="p-muted">This quiz has no questions yet.</p>
      ) : (
        <div className="space-y-5">
          {questions.map((qq, i) => {
            const graded = byId[qq.id];
            return (
              <Field key={qq.id} label={`${i + 1}. ${qq.question_text}`}>
                <div className="space-y-1.5">
                  {(qq.options ?? []).map((o: string, oi: number) => {
                    const isChosen = answers[i] === oi;
                    const isRight = graded && oi === graded.correct_index;
                    const isWrongChoice = graded && isChosen && !graded.correct;
                    return (
                      <div
                        key={oi}
                        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13.5px]"
                        style={{
                          background: isRight
                            ? "rgba(63,179,127,0.12)"
                            : isWrongChoice
                              ? "rgba(220,106,98,0.12)"
                              : isChosen
                                ? "var(--p-gold-soft)"
                                : "var(--p-hover)",
                          color: isRight
                            ? "var(--p-green)"
                            : isWrongChoice
                              ? "var(--p-red)"
                              : isChosen
                                ? "var(--p-gold)"
                                : "var(--p-text)",
                        }}
                      >
                        <Radio
                          name={`q-${qq.id}`}
                          checked={isChosen}
                          onChange={() => setAnswers((p) => ({ ...p, [i]: oi }))}
                          label={o}
                          className="w-full"
                        />
                      </div>
                    );
                  })}
                </div>
                {graded?.explanation && <p className="p-muted mt-1.5 leading-snug">Why: {graded.explanation}</p>}
              </Field>
            );
          })}

          {result && (
            <div
              className="rounded-[10px] border px-3 py-2.5 text-[13.5px]"
              style={{
                borderColor: result.passed ? "var(--p-green)" : "var(--p-red)",
                color: result.passed ? "var(--p-green)" : "var(--p-red)",
                background: result.passed ? "rgba(63,179,127,0.10)" : "rgba(220,106,98,0.10)",
              }}
            >
              {result.passed ? "Passed" : "Not passed"} — you scored {Math.round(result.score * 100)}% (need {Math.round(result.threshold * 100)}%).
              {!result.passed && " Review the answers above and try again."}
            </div>
          )}

          <Button variant="primary" size="sm" onClick={() => mut.mutate()} disabled={!allAnswered} loading={mut.isPending}>
            {result && !result.passed ? "Retake" : "Submit quiz"}
          </Button>
        </div>
      )}
    </Panel>
  );
}

