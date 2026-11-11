import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Panel,
  Button,
  Badge,
  Toolbar,
  SearchField,
  SegmentedControl,
  Table,
  TableWrap,
  THead,
  TH,
  TR,
  TD,
  EmptyState,
  ErrorState,
  TableSkeleton,
  Drawer,
  Modal,
  Field,
  Input,
  Textarea,
  Select,
  FormGrid,
  Toggle,
  notify,
} from "@/components/portal/ui";
import { MediaSourceField, TranscriptPanel } from "./media-fields";
import {
  adminListRecordings,
  adminUpsertRecording,
  adminSetRecordingStatus,
  adminDuplicateRecording,
  adminDeleteRecording,
  listPresenters,
  upsertPresenter,
  deletePresenter,
} from "@/lib/academy-content.functions";
import { Plus, Copy, Trash2, Users } from "lucide-react";

type Form = {
  presenter_id: string;
  title: string;
  topic: string;
  presenter_role: string;
  description: string;
  format: "video" | "audio";
  video_url: string;
  thumbnail_url: string;
  duration: string;
  recorded_on: string;
  featured: boolean;
  is_new: boolean;
  status: "draft" | "published";
};

const blank: Form = {
  presenter_id: "",
  title: "",
  topic: "",
  presenter_role: "",
  description: "",
  format: "video",
  video_url: "",
  thumbnail_url: "",
  duration: "",
  recorded_on: "",
  featured: false,
  is_new: false,
  status: "draft",
};

export function RecordingsManager({ initialNew = false }: { initialNew?: boolean } = {}) {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListRecordings);
  const statusFn = useServerFn(adminSetRecordingStatus);
  const dupFn = useServerFn(adminDuplicateRecording);
  const delFn = useServerFn(adminDeleteRecording);
  const q = useQuery({ queryKey: ["academy", "admin", "recordings"], queryFn: () => listFn() });
  const [edit, setEdit] = useState<null | { id?: string }>(initialNew ? {} : null);
  const [presentersOpen, setPresentersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "published" | "draft">("all");

  const recordings = (q.data?.recordings ?? []) as any[];
  const presenters = (q.data?.presenters ?? []) as any[];
  const presenterName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of presenters) m[p.id] = p.name;
    return m;
  }, [presenters]);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["academy", "admin", "recordings"] });

  const visible = recordings.filter((r) => {
    if (tab !== "all" && (r.status ?? "draft") !== tab) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${r.title} ${r.topic ?? ""} ${presenterName[r.presenter_id] ?? ""}`.toLowerCase().includes(needle);
  });

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      invalidate();
      notify.success(ok);
    } catch {
      notify.error("That didn't work. Please try again.");
    }
  }

  return (
    <>
      <Panel
        title="Recorded presentations"
        description="Trainings and calls your agents watch on demand."
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPresentersOpen(true)}>
              <Users size={13} /> Presenters
            </Button>
            <Button variant="primary" size="sm" onClick={() => setEdit({})}>
              <Plus size={14} /> New recording
            </Button>
          </div>
        }
        padded={false}
      >
        <div className="p-4 pb-0">
          <Toolbar>
            <SearchField value={query} onChange={setQuery} placeholder="Search recordings…" />
            <SegmentedControl
              size="sm"
              value={tab}
              onChange={setTab}
              options={[
                { value: "all", label: `All (${recordings.length})` },
                { value: "published", label: "Published" },
                { value: "draft", label: "Drafts" },
              ]}
            />
          </Toolbar>
        </div>

        {q.isError ? (
          <ErrorState description="Couldn't load recordings." onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No recordings yet"
            description="Add a recorded presentation to build out the Academy."
            action={<Button variant="primary" size="sm" onClick={() => setEdit({})}><Plus size={14} /> New recording</Button>}
          />
        ) : (
          <TableWrap className="border-0">
            <Table>
              <THead>
                <TH>Title</TH>
                <TH>Presenter</TH>
                <TH>Status</TH>
                <TH>Transcript</TH>
                <TH align="right" />
              </THead>
              <tbody>
                {visible.map((r) => (
                  <TR key={r.id} onClick={() => setEdit({ id: r.id })}>
                    <TD className="p-card-title">
                      {r.title}
                      {r.featured && <Badge tone="gold" className="ml-1.5">Featured</Badge>}
                      {r.is_new && <Badge tone="blue" className="ml-1.5">New</Badge>}
                    </TD>
                    <TD className="p-secondary">{presenterName[r.presenter_id] ?? "—"}</TD>
                    <TD>
                      <Badge tone={r.status === "published" ? "green" : "neutral"}>{r.status ?? "draft"}</Badge>
                    </TD>
                    <TD>
                      {r.transcript ? (
                        <Badge tone={r.transcript.status === "completed" ? "green" : r.transcript.status === "failed" ? "red" : "amber"}>
                          {r.transcript.status}
                        </Badge>
                      ) : (
                        <span className="p-muted">—</span>
                      )}
                    </TD>
                    <TD align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          className="p-focus text-[12.5px]"
                          style={{ color: "var(--p-text-2)" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            act(() => statusFn({ data: { id: r.id, status: r.status === "published" ? "draft" : "published" } }), r.status === "published" ? "Moved to drafts." : "Published.");
                          }}
                        >
                          {r.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          className="p-focus"
                          style={{ color: "var(--p-text-3)" }}
                          aria-label="Duplicate"
                          onClick={(e) => { e.stopPropagation(); act(() => dupFn({ data: { id: r.id } }), "Duplicated as a draft."); }}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          className="p-focus"
                          style={{ color: "var(--p-text-3)" }}
                          aria-label="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this recording?")) act(() => delFn({ data: { id: r.id } }), "Recording deleted.");
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      {edit && (
        <RecordingDrawer
          recording={recordings.find((r) => r.id === edit.id)}
          presenters={presenters}
          onClose={() => setEdit(null)}
          onSaved={(id) => { invalidate(); setEdit({ id }); }}
          onManagePresenters={() => setPresentersOpen(true)}
        />
      )}

      {presentersOpen && <PresentersModal onClose={() => { setPresentersOpen(false); invalidate(); }} />}
    </>
  );
}

function RecordingDrawer({
  recording,
  presenters,
  onClose,
  onSaved,
  onManagePresenters,
}: {
  recording?: any;
  presenters: any[];
  onClose: () => void;
  onSaved: (id: string) => void;
  onManagePresenters: () => void;
}) {
  const saveFn = useServerFn(adminUpsertRecording);
  const [f, setF] = useState<Form>(
    recording
      ? {
          presenter_id: recording.presenter_id ?? "",
          title: recording.title ?? "",
          topic: recording.topic ?? "",
          presenter_role: recording.presenter_role ?? "",
          description: recording.description ?? "",
          format: (recording.format ?? "video") as "video" | "audio",
          video_url: recording.video_url ?? "",
          thumbnail_url: recording.thumbnail_url ?? "",
          duration: recording.duration ?? "",
          recorded_on: recording.recorded_on ?? "",
          featured: !!recording.featured,
          is_new: !!recording.is_new,
          status: (recording.status ?? "draft") as "draft" | "published",
        }
      : blank,
  );
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  async function save(status?: "draft" | "published") {
    if (!f.title.trim() || !f.presenter_id) {
      notify.error("Add a title and pick a presenter.");
      return;
    }
    setBusy(true);
    try {
      const res = await saveFn({ data: { id: recording?.id, ...f, status: status ?? f.status } });
      if (status) set("status", status);
      notify.success("Recording saved.");
      onSaved(res.id);
    } catch {
      notify.error("Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={recording ? "Edit recording" : "New recording"}
      description={recording?.slug ? `/portal/academy/presentations/${recording.slug}` : "Recorded presentation"}
      width={620}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="secondary" loading={busy} onClick={() => save("draft")}>Save draft</Button>
          <Button variant="primary" loading={busy} onClick={() => save("published")}>Publish</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" required>
          <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Objection handling live call" />
        </Field>
        <FormGrid>
          <Field label="Presenter" required hint={<button type="button" className="p-focus underline" onClick={onManagePresenters}>Manage presenters</button>}>
            <Select value={f.presenter_id} onChange={(e) => set("presenter_id", e.target.value)}>
              <option value="">Select a presenter…</option>
              {presenters.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Presenter title shown" hint="Overrides the presenter's default role.">
            <Input value={f.presenter_role} onChange={(e) => set("presenter_role", e.target.value)} placeholder="Regional Manager" />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Topic">
            <Input value={f.topic} onChange={(e) => set("topic", e.target.value)} placeholder="Sales" />
          </Field>
          <Field label="Format">
            <Select value={f.format} onChange={(e) => set("format", e.target.value as "video" | "audio")}>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
            </Select>
          </Field>
        </FormGrid>

        <MediaSourceField
          label="Media link"
          value={f.video_url}
          onChange={(url) => set("video_url", url)}
          folder="recordings"
          accept={f.format === "audio" ? "audio/*" : "video/*"}
        />

        <FormGrid>
          <Field label="Duration"><Input value={f.duration} onChange={(e) => set("duration", e.target.value)} placeholder="42:10" /></Field>
          <Field label="Recorded on"><Input type="date" value={f.recorded_on} onChange={(e) => set("recorded_on", e.target.value)} /></Field>
        </FormGrid>
        <Field label="Thumbnail URL" hint="Optional. Leave blank to use a branded placeholder.">
          <Input value={f.thumbnail_url} onChange={(e) => set("thumbnail_url", e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Description">
          <Textarea rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <div className="space-y-3 rounded-[10px] p-3" style={{ background: "var(--p-hover)" }}>
          <Toggle checked={f.featured} onChange={(v) => set("featured", v)} label="Feature on the Academy home" />
          <Toggle checked={f.is_new} onChange={(v) => set("is_new", v)} label="Show a NEW badge" />
        </div>

        {recording?.id && (
          <TranscriptPanel ownerType="recording" ownerId={recording.id} sourceUrl={f.video_url} />
        )}
        {!recording?.id && (
          <p className="p-muted leading-snug">Save this recording first to generate a transcript and AI training notes.</p>
        )}
      </div>
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */
/* Presenters                                                                 */
/* -------------------------------------------------------------------------- */

export function PresentersModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPresenters);
  const saveFn = useServerFn(upsertPresenter);
  const delFn = useServerFn(deletePresenter);
  const q = useQuery({ queryKey: ["academy", "presenters"], queryFn: () => listFn() });
  const presenters = (q.data?.presenters ?? []) as any[];
  const staff = (q.data?.staff ?? []) as any[];
  const [f, setF] = useState({ id: "", name: "", role: "", photo_url: "", profile_id: "" });
  const [busy, setBusy] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["academy", "presenters"] });

  async function save() {
    if (!f.name.trim()) return;
    setBusy(true);
    try {
      await saveFn({
        data: {
          id: f.id || undefined,
          name: f.name.trim(),
          role: f.role,
          photo_url: f.photo_url,
          profile_id: f.profile_id || null,
        },
      });
      setF({ id: "", name: "", role: "", photo_url: "", profile_id: "" });
      invalidate();
      notify.success("Presenter saved.");
    } catch {
      notify.error("Couldn't save this presenter.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Presenters" description="People who appear on recorded presentations." width={620} onClose={onClose}>
      <div className="space-y-4">
        {presenters.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {presenters.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-[10px] px-3 py-2" style={{ background: "var(--p-hover)" }}>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium">{p.name}</div>
                  <div className="p-muted truncate">{p.role || (p.is_external ? "External" : "Team")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="p-focus text-[12.5px]"
                    style={{ color: "var(--p-text-2)" }}
                    onClick={() => setF({ id: p.id, name: p.name ?? "", role: p.role ?? "", photo_url: p.photo_url ?? "", profile_id: p.profile_id ?? "" })}
                  >
                    Edit
                  </button>
                  <button
                    className="p-focus"
                    style={{ color: "var(--p-text-3)" }}
                    aria-label="Delete presenter"
                    onClick={async () => {
                      if (!confirm("Delete this presenter?")) return;
                      try {
                        await delFn({ data: { id: p.id } });
                        invalidate();
                        notify.success("Presenter deleted.");
                      } catch {
                        notify.error("Couldn't delete — they may still be used by a recording.");
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 rounded-[10px] border p-3" style={{ borderColor: "var(--p-border)" }}>
          <div className="p-label">{f.id ? "Edit presenter" : "Add presenter"}</div>
          <FormGrid>
            <Field label="Name" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Role"><Input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="Agency Owner" /></Field>
          </FormGrid>
          <FormGrid>
            <Field label="Link to a portal user" hint="Optional — pulls their avatar automatically.">
              <Select value={f.profile_id} onChange={(e) => setF({ ...f, profile_id: e.target.value })}>
                <option value="">External presenter</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                ))}
              </Select>
            </Field>
            <Field label="Photo URL"><Input value={f.photo_url} onChange={(e) => setF({ ...f, photo_url: e.target.value })} placeholder="https://…" /></Field>
          </FormGrid>
          <div className="flex gap-2">
            {f.id && <Button variant="ghost" size="sm" onClick={() => setF({ id: "", name: "", role: "", photo_url: "", profile_id: "" })}>Cancel</Button>}
            <Button variant="primary" size="sm" loading={busy} disabled={!f.name.trim()} onClick={save}>
              {f.id ? "Save presenter" : "Add presenter"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
