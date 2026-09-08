import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
  Drawer,
  Field,
  Input,
  Textarea,
  Select,
  notify,
} from "@/components/portal/ui";
import {
  adminListTemplates,
  adminUpsertTemplate,
  adminDeleteTemplate,
  adminDuplicateTemplate,
  adminSetTemplateActive,
  adminApplyTemplate,
  TEMPLATE_KINDS,
} from "@/lib/academy-templates.functions";
import { Plus, Trash2, Copy, Wand2 } from "lucide-react";

const KIND_LABEL: Record<string, string> = {
  course: "Course",
  library: "Library set",
  recording: "Recording",
};

export function TemplatesManager({ onApplied }: { onApplied?: (kind: string) => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListTemplates);
  const applyFn = useServerFn(adminApplyTemplate);
  const delFn = useServerFn(adminDeleteTemplate);
  const dupFn = useServerFn(adminDuplicateTemplate);
  const activeFn = useServerFn(adminSetTemplateActive);
  const q = useQuery({ queryKey: ["academy", "templates"], queryFn: () => listFn() });
  const [edit, setEdit] = useState<null | { id?: string }>(null);
  const templates = (q.data?.templates ?? []) as any[];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["academy"] });
  };

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      invalidate();
      notify.success(ok);
    } catch (e: any) {
      notify.error(e?.message ?? "That didn't work. Please try again.");
    }
  }

  return (
    <>
      <Panel
        title="How templates work"
        description="A template is a reusable starting point. Applying one creates a draft copy you edit and publish — nothing goes live on its own. Duplicating copies one existing item instead."
      >
        <p className="p-secondary leading-snug">
          Save any finished course as a template so you can reuse its structure later. Hidden templates stay saved
          but don't appear in the picker.
        </p>
      </Panel>

      <Panel
        title="Templates"
        description="Starting points for courses, library sets and recordings."
        actions={
          <Button variant="primary" size="sm" onClick={() => setEdit({})}>
            <Plus size={14} /> New template
          </Button>
        }
        padded={false}
        className="mt-4"
      >
        {q.isError ? (
          <ErrorState description="Couldn't load templates." onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : templates.length === 0 ? (
          <EmptyState title="No templates yet" description="Create one, or save an existing course as a template." />
        ) : (
          <TableWrap className="border-0">
            <Table>
              <THead>
                <TH>Title</TH>
                <TH>Kind</TH>
                <TH>Visibility</TH>
                <TH align="right" />
              </THead>
              <tbody>
                {templates.map((t) => (
                  <TR key={t.id} onClick={() => setEdit({ id: t.id })}>
                    <TD className="p-card-title">
                      {t.title}
                      {t.description && <span className="p-secondary ml-2">{t.description}</span>}
                    </TD>
                    <TD>
                      <Badge tone="blue">{KIND_LABEL[t.kind] ?? t.kind}</Badge>
                    </TD>
                    <TD>
                      <Badge tone={t.is_active ? "green" : "neutral"}>{t.is_active ? "Visible" : "Hidden"}</Badge>
                    </TD>
                    <TD align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          className="p-focus inline-flex items-center gap-1 text-[12.5px]"
                          style={{ color: "var(--p-gold)" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            act(async () => {
                              await applyFn({ data: { id: t.id } });
                              onApplied?.(t.kind);
                            }, "Created as a draft — edit it, then publish.");
                          }}
                        >
                          <Wand2 size={13} /> Use
                        </button>
                        <button
                          className="p-focus text-[12.5px]"
                          style={{ color: "var(--p-text-2)" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            act(() => activeFn({ data: { id: t.id, is_active: !t.is_active } }), t.is_active ? "Hidden." : "Visible.");
                          }}
                        >
                          {t.is_active ? "Hide" : "Show"}
                        </button>
                        <button
                          className="p-focus"
                          style={{ color: "var(--p-text-3)" }}
                          aria-label="Duplicate template"
                          onClick={(e) => {
                            e.stopPropagation();
                            act(() => dupFn({ data: { id: t.id } }), "Template duplicated.");
                          }}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          className="p-focus"
                          style={{ color: "var(--p-text-3)" }}
                          aria-label="Delete template"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this template?")) act(() => delFn({ data: { id: t.id } }), "Template deleted.");
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
        <TemplateDrawer
          template={templates.find((t) => t.id === edit.id)}
          onClose={() => setEdit(null)}
          onSaved={() => {
            invalidate();
            setEdit(null);
          }}
        />
      )}
    </>
  );
}

function TemplateDrawer({
  template,
  onClose,
  onSaved,
}: {
  template?: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const saveFn = useServerFn(adminUpsertTemplate);
  const [kind, setKind] = useState<string>(template?.kind ?? "course");
  const [title, setTitle] = useState(template?.title ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [payload, setPayload] = useState(
    JSON.stringify(template?.payload ?? SAMPLES[template?.kind ?? "course"], null, 2),
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      notify.error("The template content isn't valid JSON.");
      return;
    }
    setBusy(true);
    try {
      await saveFn({ data: { id: template?.id, kind: kind as any, title, description, payload: parsed } });
      notify.success("Template saved.");
      onSaved();
    } catch (e: any) {
      notify.error(e?.message ?? "Couldn't save this template.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={template ? "Edit template" : "New template"}
      description="Templates create drafts you can edit before publishing."
      width={680}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" loading={busy} onClick={save}>
            Save template
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New Agent Fast Start" />
        </Field>
        <Field label="What it creates">
          <Select
            value={kind}
            onChange={(e) => {
              const k = e.target.value;
              setKind(k);
              if (!template) setPayload(JSON.stringify(SAMPLES[k], null, 2));
            }}
          >
            {TEMPLATE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field
          label="Template content"
          hint="The outline this template creates. Edit carefully — titles and lessons come from here."
        >
          <Textarea rows={18} value={payload} onChange={(e) => setPayload(e.target.value)} className="font-mono text-[12px]" />
        </Field>
      </div>
    </Drawer>
  );
}

const SAMPLES: Record<string, unknown> = {
  course: {
    course: { title: "New course", description: "", outcomes: [], is_required: false },
    modules: [{ title: "Module 1", lessons: [{ title: "Lesson 1", kind: "video" }] }],
  },
  library: { items: [{ title: "New document", type: "pdf", category: "Scripts" }] },
  recording: { title: "New recording", topic: "", format: "video" },
};
