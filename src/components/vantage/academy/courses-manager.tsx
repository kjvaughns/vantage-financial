import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Panel,
  Button,
  Badge,
  Table,
  TableWrap,
  THead,
  TH,
  TR,
  TD,
  EmptyState,
  ErrorState,
  TableSkeleton,
  CardSkeleton,
  Drawer,
  Modal,
  Field,
  Input,
  Textarea,
  Select,
  FormGrid,
  Toggle,
  Radio,
  notify,
} from "@/components/portal/ui";
import { MediaSourceField, TranscriptPanel } from "./media-fields";
import {
  adminListCourses,
  adminGetCourse,
  adminUpsertCourse,
  adminDeleteCourse,
  adminUpsertModule,
  adminUpsertLesson,
  adminDuplicateLesson,
  adminSetLessonPublished,
  adminUpsertQuestion,
  adminDeleteNode,
  adminReorder,
} from "@/lib/academy.functions";
import {
  adminDuplicateCourse,
  adminSetCourseStatus,
  adminSaveCourseAsTemplate,
} from "@/lib/academy-templates.functions";
import {
  GripVertical,
  Plus,
  Trash2,
  Pencil,
  Copy,
  Video,
  Headphones,
  FileText,
  Link2,
  HelpCircle,
  Paperclip,
} from "lucide-react";

type LessonKind = "video" | "audio" | "text" | "resource" | "link" | "quiz";

const KIND_META: Record<LessonKind, { label: string; icon: ReactNode }> = {
  video: { label: "Video", icon: <Video size={14} /> },
  audio: { label: "Audio", icon: <Headphones size={14} /> },
  text: { label: "Text", icon: <FileText size={14} /> },
  resource: { label: "Resource", icon: <Paperclip size={14} /> },
  link: { label: "Link", icon: <Link2 size={14} /> },
  quiz: { label: "Quiz", icon: <HelpCircle size={14} /> },
};

/* -------------------------------------------------------------------------- */
/* DnD helpers                                                                */
/* -------------------------------------------------------------------------- */

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="flex items-center gap-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="p-focus cursor-grab touch-none"
        style={{ color: "var(--p-text-3)" }}
        aria-label="Drag to reorder"
      >
        <GripVertical size={15} />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function SortableList({ ids, onReorder, children }: { ids: string[]; onReorder: (ids: string[]) => void; children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldI = ids.indexOf(active.id as string);
      const newI = ids.indexOf(over.id as string);
      if (oldI >= 0 && newI >= 0) onReorder(arrayMove(ids, oldI, newI));
    }
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/* -------------------------------------------------------------------------- */
/* Courses list + builder                                                     */
/* -------------------------------------------------------------------------- */

export function CoursesManager() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListCourses);
  const delFn = useServerFn(adminDeleteCourse);
  const coursesQ = useQuery({ queryKey: ["academy", "courses"], queryFn: () => listFn() });
  const [selected, setSelected] = useState<string | null>(null);
  const [metaOpen, setMetaOpen] = useState<null | { id?: string }>(null);
  const courses = (coursesQ.data?.courses ?? []) as any[];

  async function del(id: string) {
    if (!confirm("Delete this course and all of its content?")) return;
    try {
      await delFn({ data: { id } });
      if (selected === id) setSelected(null);
      qc.invalidateQueries({ queryKey: ["academy", "courses"] });
      notify.success("Course deleted.");
    } catch {
      notify.error("Couldn't delete this course.");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-start">
      <Panel
        title="Courses"
        description="Structured, multi-lesson training."
        actions={<Button variant="primary" size="sm" onClick={() => setMetaOpen({})}><Plus size={14} /> New</Button>}
        padded={false}
      >
        {coursesQ.isError ? (
          <ErrorState description="Couldn't load courses." onRetry={() => coursesQ.refetch()} />
        ) : coursesQ.isLoading ? (
          <TableSkeleton rows={4} cols={3} />
        ) : courses.length === 0 ? (
          <EmptyState title="No courses yet" description="Build your first course for new agents." />
        ) : (
          <TableWrap className="border-0">
            <Table>
              <THead><TH>Title</TH><TH>Status</TH><TH align="right" /></THead>
              <tbody>
                {courses.map((c) => (
                  <TR key={c.id} onClick={() => setSelected(c.id)} className={selected === c.id ? "bg-[var(--p-hover)]" : ""}>
                    <TD className="p-card-title">
                      {c.title} {c.is_required && <Badge tone="gold" className="ml-1">Required</Badge>}
                    </TD>
                    <TD><Badge tone={c.status === "published" ? "green" : "neutral"}>{c.status}</Badge></TD>
                    <TD align="right">
                      <button onClick={(e) => { e.stopPropagation(); del(c.id); }} className="p-focus" style={{ color: "var(--p-text-3)" }} aria-label="Delete course">
                        <Trash2 size={15} />
                      </button>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      {selected ? (
        <CourseBuilder courseId={selected} onEditMeta={(id) => setMetaOpen({ id })} />
      ) : (
        <Panel><EmptyState title="Select a course" description="Pick a course to build its modules and lessons." /></Panel>
      )}

      {metaOpen && (
        <CourseMetaModal
          courseId={metaOpen.id}
          onClose={() => setMetaOpen(null)}
          onSaved={(id) => {
            setMetaOpen(null);
            setSelected(id);
            qc.invalidateQueries({ queryKey: ["academy", "courses"] });
            qc.invalidateQueries({ queryKey: ["academy", "course", id] });
          }}
        />
      )}
    </div>
  );
}

function CourseMetaModal({ courseId, onClose, onSaved }: { courseId?: string; onClose: () => void; onSaved: (id: string) => void }) {
  const getFn = useServerFn(adminGetCourse);
  const saveFn = useServerFn(adminUpsertCourse);
  const existing = useQuery({
    queryKey: ["academy", "course-meta", courseId],
    queryFn: () => getFn({ data: { id: courseId! } }),
    enabled: !!courseId,
  });
  const c = existing.data?.course as any;
  const [f, setF] = useState({
    title: "",
    description: "",
    long_description: "",
    instructor_name: "",
    instructor_role: "",
    thumbnail_url: "",
    outcomes: "",
    is_required: false,
    status: "draft" as "draft" | "published",
  });
  const [loaded, setLoaded] = useState(false);
  if (c && !loaded) {
    setF({
      title: c.title ?? "",
      description: c.description ?? "",
      long_description: c.long_description ?? "",
      instructor_name: c.instructor_name ?? "",
      instructor_role: c.instructor_role ?? "",
      thumbnail_url: c.thumbnail_url ?? "",
      outcomes: (c.outcomes ?? []).join("\n"),
      is_required: !!c.is_required,
      status: c.status ?? "draft",
    });
    setLoaded(true);
  }
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!f.title.trim()) return;
    setBusy(true);
    try {
      const res = await saveFn({
        data: {
          id: courseId,
          title: f.title.trim(),
          description: f.description,
          long_description: f.long_description,
          instructor_name: f.instructor_name,
          instructor_role: f.instructor_role,
          thumbnail_url: f.thumbnail_url,
          outcomes: f.outcomes.split("\n").map((s) => s.trim()).filter(Boolean),
          is_required: f.is_required,
          status: f.status,
        },
      });
      notify.success("Course saved.");
      onSaved(res.id);
    } catch {
      notify.error("Couldn't save. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={courseId ? "Course details" : "New course"}
      width={620}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!f.title.trim()} loading={busy}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Short description"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="About this course"><Textarea rows={4} value={f.long_description} onChange={(e) => setF({ ...f, long_description: e.target.value })} /></Field>
        <Field label="What agents will learn" hint="One outcome per line.">
          <Textarea rows={4} value={f.outcomes} onChange={(e) => setF({ ...f, outcomes: e.target.value })} />
        </Field>
        <FormGrid>
          <Field label="Instructor name"><Input value={f.instructor_name} onChange={(e) => setF({ ...f, instructor_name: e.target.value })} /></Field>
          <Field label="Instructor role"><Input value={f.instructor_role} onChange={(e) => setF({ ...f, instructor_role: e.target.value })} /></Field>
        </FormGrid>
        <FormGrid>
          <Field label="Thumbnail URL"><Input value={f.thumbnail_url} onChange={(e) => setF({ ...f, thumbnail_url: e.target.value })} placeholder="https://…" /></Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as any })}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </Select>
          </Field>
        </FormGrid>
        <Toggle checked={f.is_required} onChange={(v) => setF({ ...f, is_required: v })} label="Required for all agents" />
      </div>
    </Modal>
  );
}

function CourseBuilder({ courseId, onEditMeta }: { courseId: string; onEditMeta: (id: string) => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetCourse);
  const upModule = useServerFn(adminUpsertModule);
  const reorderFn = useServerFn(adminReorder);
  const delNode = useServerFn(adminDeleteNode);
  const dupLesson = useServerFn(adminDuplicateLesson);
  const pubLesson = useServerFn(adminSetLessonPublished);
  const q = useQuery({ queryKey: ["academy", "course", courseId], queryFn: () => getFn({ data: { id: courseId } }) });
  const [lessonEdit, setLessonEdit] = useState<null | { moduleId: string; lessonId?: string }>(null);
  const [moduleEdit, setModuleEdit] = useState<null | { id?: string; title: string }>(null);

  const course = q.data?.course as any;
  const modules = (q.data?.modules ?? []) as any[];
  const lessons = (q.data?.lessons ?? []) as any[];
  const questions = (q.data?.questions ?? []) as any[];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["academy", "course", courseId] });

  async function saveModule() {
    if (!moduleEdit?.title.trim()) return;
    await upModule({ data: { id: moduleEdit.id, course_id: courseId, title: moduleEdit.title.trim() } });
    setModuleEdit(null);
    invalidate();
  }

  if (q.isError) return <Panel><ErrorState description="Couldn't load this course." onRetry={() => q.refetch()} /></Panel>;
  if (q.isLoading) return <Panel><CardSkeleton lines={5} /></Panel>;

  return (
    <Panel
      title={course?.title ?? "Course"}
      description={`${lessons.length} lesson${lessons.length === 1 ? "" : "s"} · ${modules.length} module${modules.length === 1 ? "" : "s"}`}
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => onEditMeta(courseId)}><Pencil size={13} /> Details</Button>
          <Link to="/portal/academy/courses/$slug" params={{ slug: course?.slug ?? "" }}>
            <Button variant="secondary" size="sm">Preview</Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-3">
        <SortableList ids={modules.map((m) => m.id)} onReorder={async (ids) => { await reorderFn({ data: { kind: "module", ids } }); invalidate(); }}>
          {modules.map((m) => {
            const modLessons = lessons.filter((l) => l.module_id === m.id);
            return (
              <div key={m.id} className="p-panel mb-2 p-3">
                <SortableRow id={m.id}>
                  <div className="flex items-center gap-2">
                    <span className="p-card-title flex-1 truncate">{m.title}</span>
                    <Button variant="ghost" size="sm" onClick={() => setModuleEdit({ id: m.id, title: m.title })}><Pencil size={13} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setLessonEdit({ moduleId: m.id })}><Plus size={13} /> Lesson</Button>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this module and its lessons?")) return;
                        await delNode({ data: { kind: "module", id: m.id } });
                        invalidate();
                      }}
                      className="p-focus"
                      style={{ color: "var(--p-text-3)" }}
                      aria-label="Delete module"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </SortableRow>

                <div className="mt-2 pl-6">
                  <SortableList ids={modLessons.map((l) => l.id)} onReorder={async (ids) => { await reorderFn({ data: { kind: "lesson", ids } }); invalidate(); }}>
                    {modLessons.map((l) => {
                      const meta = KIND_META[(l.kind ?? "video") as LessonKind] ?? KIND_META.video;
                      return (
                        <div key={l.id} className="mb-1.5 rounded-[8px] px-2 py-1.5" style={{ background: "var(--p-hover)" }}>
                          <SortableRow id={l.id}>
                            <div className="flex items-center gap-2">
                              <span style={{ color: "var(--p-text-2)" }}>{meta.icon}</span>
                              <button onClick={() => setLessonEdit({ moduleId: m.id, lessonId: l.id })} className="p-focus flex-1 truncate text-left text-[13px]">
                                {l.title}
                              </button>
                              {l.duration && <span className="p-muted shrink-0">{l.duration}</span>}
                              {l.is_published === false && <Badge tone="neutral">Draft</Badge>}
                              <button
                                className="p-focus text-[12px]"
                                style={{ color: "var(--p-text-2)" }}
                                onClick={async () => { await pubLesson({ data: { id: l.id, is_published: l.is_published === false } }); invalidate(); }}
                              >
                                {l.is_published === false ? "Publish" : "Unpublish"}
                              </button>
                              <button
                                className="p-focus"
                                style={{ color: "var(--p-text-3)" }}
                                aria-label="Duplicate lesson"
                                onClick={async () => { await dupLesson({ data: { id: l.id } }); invalidate(); }}
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                className="p-focus"
                                style={{ color: "var(--p-text-3)" }}
                                aria-label="Delete lesson"
                                onClick={async () => {
                                  if (!confirm("Delete this lesson?")) return;
                                  await delNode({ data: { kind: "lesson", id: l.id } });
                                  invalidate();
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </SortableRow>
                        </div>
                      );
                    })}
                  </SortableList>
                  {modLessons.length === 0 && <div className="p-muted py-1">No lessons yet.</div>}
                </div>
              </div>
            );
          })}
        </SortableList>

        <Button variant="ghost" size="sm" onClick={() => setModuleEdit({ title: "" })}><Plus size={14} /> Add module</Button>
      </div>

      {moduleEdit && (
        <Modal
          title={moduleEdit.id ? "Rename module" : "New module"}
          onClose={() => setModuleEdit(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModuleEdit(null)}>Cancel</Button>
              <Button variant="primary" disabled={!moduleEdit.title.trim()} onClick={saveModule}>Save</Button>
            </>
          }
        >
          <Field label="Module title" required>
            <Input autoFocus value={moduleEdit.title} onChange={(e) => setModuleEdit({ ...moduleEdit, title: e.target.value })} placeholder="Getting started" />
          </Field>
        </Modal>
      )}

      {lessonEdit && (
        <LessonDrawer
          moduleId={lessonEdit.moduleId}
          lessonId={lessonEdit.lessonId}
          lesson={lessons.find((l) => l.id === lessonEdit.lessonId)}
          questions={questions}
          onClose={() => setLessonEdit(null)}
          onSaved={(id) => { invalidate(); setLessonEdit({ moduleId: lessonEdit.moduleId, lessonId: id }); }}
        />
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Lesson drawer                                                              */
/* -------------------------------------------------------------------------- */

function LessonDrawer({
  moduleId,
  lessonId,
  lesson,
  questions,
  onClose,
  onSaved,
}: {
  moduleId: string;
  lessonId?: string;
  lesson?: any;
  questions: any[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const saveFn = useServerFn(adminUpsertLesson);
  const [f, setF] = useState({
    title: lesson?.title ?? "",
    kind: ((lesson?.kind === "lesson" ? "video" : lesson?.kind) ?? "video") as LessonKind,
    video_url: lesson?.video_url ?? "",
    resource_url: lesson?.resource_url ?? "",
    resource_label: lesson?.resource_label ?? "",
    body: lesson?.body ?? "",
    duration: lesson?.duration ?? "",
    blurb: lesson?.blurb ?? "",
    is_published: lesson?.is_published !== false,
    quiz_pass_threshold: lesson?.quiz_pass_threshold ?? 0.75,
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));
  const isMedia = f.kind === "video" || f.kind === "audio";

  async function save() {
    if (!f.title.trim()) {
      notify.error("Add a lesson title.");
      return;
    }
    setBusy(true);
    try {
      const res = await saveFn({
        data: {
          id: lessonId,
          module_id: moduleId,
          title: f.title.trim(),
          kind: f.kind,
          video_url: isMedia ? f.video_url : "",
          resource_url: f.kind === "resource" || f.kind === "link" ? f.resource_url : "",
          resource_label: f.resource_label,
          body: f.kind === "text" ? f.body : "",
          duration: f.duration,
          blurb: f.blurb,
          is_published: f.is_published,
          quiz_pass_threshold: Number(f.quiz_pass_threshold) || 0.75,
        },
      });
      notify.success("Lesson saved.");
      onSaved(res.id);
    } catch {
      notify.error("Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={lessonId ? "Edit lesson" : "New lesson"}
      width={620}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" loading={busy} onClick={save}>Save lesson</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <Field label="Title" required><Input value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Lesson type">
            <Select value={f.kind} onChange={(e) => set({ kind: e.target.value as LessonKind })}>
              {(Object.keys(KIND_META) as LessonKind[]).map((k) => (
                <option key={k} value={k}>{KIND_META[k].label}</option>
              ))}
            </Select>
          </Field>
        </FormGrid>

        {isMedia && (
          <>
            <MediaSourceField
              value={f.video_url}
              onChange={(url) => set({ video_url: url })}
              folder="lessons"
              accept={f.kind === "audio" ? "audio/*" : "video/*"}
            />
            <Field label="Duration"><Input value={f.duration} onChange={(e) => set({ duration: e.target.value })} placeholder="12:30" /></Field>
          </>
        )}

        {f.kind === "text" && (
          <Field label="Lesson content" hint="Plain text or simple markdown.">
            <Textarea rows={10} value={f.body} onChange={(e) => set({ body: e.target.value })} />
          </Field>
        )}

        {(f.kind === "resource" || f.kind === "link") && (
          <>
            <MediaSourceField
              label={f.kind === "link" ? "Link" : "File or link"}
              value={f.resource_url}
              onChange={(url) => set({ resource_url: url })}
              folder="lessons"
            />
            <Field label="Button label"><Input value={f.resource_label} onChange={(e) => set({ resource_label: e.target.value })} placeholder="Download the worksheet" /></Field>
          </>
        )}

        {f.kind === "quiz" && (
          <Field label="Pass threshold" hint="0–1 (0.75 = 75% correct to pass).">
            <Input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={String(f.quiz_pass_threshold)}
              onChange={(e) => set({ quiz_pass_threshold: Number(e.target.value) })}
            />
          </Field>
        )}

        <Field label="Summary shown to agents"><Textarea rows={3} value={f.blurb} onChange={(e) => set({ blurb: e.target.value })} /></Field>
        <Toggle checked={f.is_published} onChange={(v) => set({ is_published: v })} label="Visible to agents" />

        {f.kind === "quiz" &&
          (lessonId ? (
            <QuestionsEditor lessonId={lessonId} questions={questions.filter((qq) => qq.lesson_id === lessonId)} />
          ) : (
            <p className="p-muted">Save the quiz first, then add questions.</p>
          ))}

        {lessonId && isMedia && <TranscriptPanel ownerType="lesson" ownerId={lessonId} sourceUrl={f.video_url} />}
      </div>
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */
/* Quiz questions                                                             */
/* -------------------------------------------------------------------------- */

function QuestionsEditor({ lessonId, questions }: { lessonId: string; questions: any[] }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(adminUpsertQuestion);
  const delFn = useServerFn(adminDeleteNode);
  const [text, setText] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["academy", "course"] });

  async function add() {
    const clean = opts.map((o) => o.trim()).filter(Boolean);
    if (!text.trim() || clean.length < 2) {
      notify.error("Add a question and at least 2 answers.");
      return;
    }
    await saveFn({
      data: {
        lesson_id: lessonId,
        question_text: text.trim(),
        options: clean,
        correct_index: Math.min(correct, clean.length - 1),
        explanation,
      },
    });
    setText(""); setOpts(["", "", "", ""]); setCorrect(0); setExplanation("");
    invalidate();
  }

  return (
    <div className="space-y-3">
      <div className="p-label">Questions ({questions.length})</div>
      {questions.map((qq, i) => (
        <div key={qq.id} className="p-panel p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[13.5px] font-medium">{i + 1}. {qq.question_text}</span>
            <button
              onClick={async () => { await delFn({ data: { kind: "question", id: qq.id } }); invalidate(); }}
              className="p-focus"
              style={{ color: "var(--p-text-3)" }}
              aria-label="Delete question"
            >
              <Trash2 size={13} />
            </button>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {(qq.options ?? []).map((o: string, oi: number) => (
              <li key={oi} className="text-[12.5px]" style={{ color: oi === qq.correct_index ? "var(--p-green)" : "var(--p-text-2)" }}>
                {oi === qq.correct_index ? "✓ " : "• "}{o}
              </li>
            ))}
          </ul>
          {qq.explanation && <p className="p-muted mt-1.5 leading-snug">Why: {qq.explanation}</p>}
        </div>
      ))}

      <div className="p-panel space-y-2 p-3">
        <Input placeholder="Question" value={text} onChange={(e) => setText(e.target.value)} />
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <Radio name="correct" checked={correct === i} onChange={() => setCorrect(i)} label={<span className="sr-only">{`Mark answer ${i + 1} correct`}</span>} />
            <Input placeholder={`Answer ${i + 1}`} value={o} onChange={(e) => setOpts(opts.map((x, xi) => (xi === i ? e.target.value : x)))} />
          </div>
        ))}
        <Textarea rows={2} placeholder="Explanation shown after answering (optional)" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        <Button variant="secondary" size="sm" onClick={add}><Plus size={13} /> Add question</Button>
      </div>
    </div>
  );
}
