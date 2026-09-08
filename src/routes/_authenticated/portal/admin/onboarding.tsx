import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { getMe } from "@/lib/portal.functions";
import {
  getOnboardingAdmin,
  saveOnboardingStep,
  deleteOnboardingStep,
  duplicateOnboardingStep,
  reorderOnboarding,
  saveOnboardingSection,
  deleteOnboardingSection,
  saveScheduleItem,
  deleteScheduleItem,
  saveAppLink,
  type OnboardingStepRow,
  type ScheduleItemRow,
  type AppLinkRow,
} from "@/lib/onboarding-content.functions";
import {
  PageHeader,
  PageBody,
  Panel,
  Badge,
  Button,
  IconButton,
  Tabs,
  Toolbar,
  ToolbarSpacer,
  EmptyState,
  CardSkeleton,
  Drawer,
  Field,
  FormGrid,
  Input,
  Textarea,
  Select,
  Toggle,
  notify,
} from "@/components/portal/ui";
import { ChevronLeft, ChevronUp, ChevronDown, Copy, Pencil, Trash2, Plus } from "lucide-react";

type Tab = "steps" | "schedule" | "links";

export const Route = createFileRoute("/_authenticated/portal/admin/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding builder — Vantage Portal" },
      { name: "description", content: "Build the new agent onboarding checklist, weekly schedule and shared links." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingAdmin,
});

const ACTION_LABELS: Record<string, string> = {
  none: "No button",
  external: "Outside link",
  internal: "Page in the portal",
  course: "An Academy course",
  resource: "A library item",
  presentation: "A recorded presentation",
};

const MODE_LABELS: Record<string, string> = {
  self: "The agent checks it off",
  admin: "A leader confirms it",
  auto: "Completes itself when the course is finished",
};

const INTERNAL_PAGES = [
  "/portal",
  "/portal/academy",
  "/portal/onboarding",
  "/portal/calendar",
  "/portal/tasks",
  "/portal/leaderboard",
  "/portal/organization",
  "/portal/settings",
];

function OnboardingAdmin() {
  const meFn = useServerFn(getMe);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const roles = meQ.data?.roles ?? [];
  const profile = meQ.data?.profile as any;
  const canManage = roles.some((r) => r === "admin" || r === "super_admin") || !!profile?.can_manage_resources;
  const [tab, setTab] = useState<Tab>("steps");

  const adminFn = useServerFn(getOnboardingAdmin);
  const q = useQuery({ queryKey: ["onboarding", "admin"], queryFn: () => adminFn(), enabled: canManage });

  if (meQ.isLoading || (canManage && q.isLoading))
    return (
      <PortalShell>
        <PageBody>
          <CardSkeleton lines={5} />
        </PageBody>
      </PortalShell>
    );

  if (!canManage)
    return (
      <PortalShell>
        <PageBody>
          <EmptyState title="Not permitted" description="Only admins and leaders with content access can build onboarding." />
        </PageBody>
      </PortalShell>
    );

  return (
    <PortalShell>
      <PageBody>
        <Link to="/portal/admin" className="p-focus mb-3 inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--p-text-2)" }}>
          <ChevronLeft size={15} /> Admin
        </Link>
        <PageHeader
          title="Onboarding builder"
          description="Everything a new agent is asked to do. Change it here — no code needed."
        />
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: "steps", label: "Steps" },
            { value: "schedule", label: "Weekly schedule" },
            { value: "links", label: "Shared links" },
          ]}
        />
        <div className="mt-4">
          {tab === "steps" && <StepsTab data={q.data} />}
          {tab === "schedule" && <ScheduleTab items={(q.data?.schedule ?? []) as ScheduleItemRow[]} />}
          {tab === "links" && <LinksTab links={(q.data?.links ?? []) as AppLinkRow[]} />}
        </div>
      </PageBody>
    </PortalShell>
  );
}

// ---------------------------------------------------------------- Steps tab

function StepsTab({ data }: { data: any }) {
  const qc = useQueryClient();
  const saveStep = useServerFn(saveOnboardingStep);
  const delStep = useServerFn(deleteOnboardingStep);
  const dupStep = useServerFn(duplicateOnboardingStep);
  const reorder = useServerFn(reorderOnboarding);
  const saveSection = useServerFn(saveOnboardingSection);
  const delSection = useServerFn(deleteOnboardingSection);

  const [editing, setEditing] = useState<Partial<OnboardingStepRow> | null>(null);
  const [sectionOpen, setSectionOpen] = useState<{ id?: string; title: string; description: string } | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["onboarding"] });
    qc.invalidateQueries({ queryKey: ["my-onboarding"] });
  };

  const stepMut = useMutation({
    mutationFn: (v: any) => saveStep({ data: v }),
    onSuccess: () => {
      setEditing(null);
      refresh();
      notify.success("Step saved.");
    },
    onError: (e: any) => notify.error("Could not save that step.", e?.message ?? "Please try again."),
  });
  const simple = (fn: (v: any) => Promise<any>, msg: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => {
        refresh();
        notify.success(msg);
      },
      onError: (e: any) => notify.error("That didn't work.", e?.message ?? "Please try again."),
    });
  const delMut = simple((id: string) => delStep({ data: { id } }), "Step deleted.");
  const dupMut = simple((id: string) => dupStep({ data: { id } }), "Step duplicated.");
  const moveMut = simple(
    (v: { id: string; direction: "up" | "down" }) => reorder({ data: { table: "onboarding_steps", ...v } }),
    "Order updated.",
  );
  const sectionMut = useMutation({
    mutationFn: (v: any) => saveSection({ data: v }),
    onSuccess: () => {
      setSectionOpen(null);
      refresh();
      notify.success("Section saved.");
    },
    onError: (e: any) => notify.error("Could not save that section.", e?.message ?? "Please try again."),
  });
  const delSectionMut = simple((id: string) => delSection({ data: { id } }), "Section deleted.");

  const steps = (data?.steps ?? []) as OnboardingStepRow[];
  const sections = (data?.sections ?? []) as any[];
  const grouped = useMemo(() => {
    const map = new Map<string, OnboardingStepRow[]>();
    for (const s of steps) {
      const k = s.section_id ?? "none";
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return map;
  }, [steps]);

  const groups = [...sections.map((s) => ({ id: s.id, title: s.title, description: s.description, is_published: s.is_published })), { id: "none", title: "Not in a section", description: null, is_published: true }];

  return (
    <div className="space-y-4">
      <Panel>
        <p className="p-secondary leading-snug">
          Steps show up for new agents in the order below. A step can open an outside link, a page in the portal, a
          course, a library item or a recording — and it can be checked off by the agent, confirmed by a leader, or
          tick itself off when a linked course is finished. Unpublished steps are invisible to agents and don't count
          toward their progress.
        </p>
      </Panel>

      <Toolbar>
        <span className="p-label">{steps.length} steps</span>
        <ToolbarSpacer />
        <Button variant="secondary" size="sm" onClick={() => setSectionOpen({ title: "", description: "" })}>
          Add section
        </Button>
        <Button variant="primary" size="sm" onClick={() => setEditing({ action_type: "none", completion_mode: "self", is_published: true, is_required: true })}>
          <Plus size={14} /> Add step
        </Button>
      </Toolbar>

      {groups.map((g) => {
        const rows = grouped.get(g.id) ?? [];
        if (g.id === "none" && rows.length === 0) return null;
        return (
          <Panel
            key={g.id}
            title={
              <span className="inline-flex items-center gap-2">
                {g.title}
                {!g.is_published && <Badge tone="neutral">Hidden</Badge>}
              </span>
            }
            actions={
              g.id === "none" ? undefined : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setSectionOpen({ id: g.id, title: g.title, description: g.description ?? "" })}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Delete this section? Its steps stay but move out of the section.")) delSectionMut.mutate(g.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )
            }
            padded={false}
          >
            {rows.length === 0 ? (
              <div className="px-4 py-6">
                <p className="p-secondary">No steps in this section yet.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--p-border)" }}>
                {rows.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="p-card-title">{s.title}</span>
                        {!s.is_published && <Badge tone="neutral">Draft</Badge>}
                        {s.is_required ? <Badge tone="gold">Required</Badge> : <Badge tone="neutral">Optional</Badge>}
                        <Badge tone="blue">{MODE_LABELS[s.completion_mode]}</Badge>
                      </div>
                      {s.description && <p className="p-secondary mt-1 leading-snug">{s.description}</p>}
                      <p className="p-muted mt-1 text-[12px]">
                        {ACTION_LABELS[s.action_type]}
                        {s.action_url ? ` · ${s.action_url}` : ""}
                        {s.internal_path ? ` · ${s.internal_path}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-1">
                      <IconButton label="Move up" onClick={() => moveMut.mutate({ id: s.id, direction: "up" })}>
                        <ChevronUp size={15} />
                      </IconButton>
                      <IconButton label="Move down" onClick={() => moveMut.mutate({ id: s.id, direction: "down" })}>
                        <ChevronDown size={15} />
                      </IconButton>
                      <IconButton label="Duplicate" onClick={() => dupMut.mutate(s.id)}>
                        <Copy size={15} />
                      </IconButton>
                      <IconButton label="Edit" onClick={() => setEditing(s)}>
                        <Pencil size={15} />
                      </IconButton>
                      <IconButton
                        label="Delete"
                        onClick={() => {
                          if (confirm(`Delete "${s.title}"? Agents will no longer see it.`)) delMut.mutate(s.id);
                        }}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        );
      })}

      {editing && (
        <StepDrawer
          value={editing}
          data={data}
          saving={stepMut.isPending}
          onClose={() => setEditing(null)}
          onSave={(v) => stepMut.mutate(v)}
        />
      )}

      {sectionOpen && (
        <Drawer title={sectionOpen.id ? "Edit section" : "Add section"} onClose={() => setSectionOpen(null)}>
          <FormGrid>
            <Field label="Section title">
              <Input value={sectionOpen.title} onChange={(e) => setSectionOpen({ ...sectionOpen, title: e.target.value })} />
            </Field>
            <Field label="Description" hint="Shown under the section title.">
              <Textarea rows={3} value={sectionOpen.description} onChange={(e) => setSectionOpen({ ...sectionOpen, description: e.target.value })} />
            </Field>
          </FormGrid>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" loading={sectionMut.isPending} onClick={() => sectionMut.mutate(sectionOpen)}>
              Save section
            </Button>
            <Button variant="secondary" onClick={() => setSectionOpen(null)}>
              Cancel
            </Button>
          </div>
        </Drawer>
      )}
    </div>
  );
}

function slugKey(t: string) {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function StepDrawer({
  value,
  data,
  saving,
  onClose,
  onSave,
}: {
  value: Partial<OnboardingStepRow>;
  data: any;
  saving: boolean;
  onClose: () => void;
  onSave: (v: any) => void;
}) {
  const [v, setV] = useState<Partial<OnboardingStepRow>>(value);
  const set = (patch: Partial<OnboardingStepRow>) => setV((p) => ({ ...p, ...patch }));
  const isNew = !v.id;
  const courses = (data?.courses ?? []) as { id: string; title: string }[];
  const resources = (data?.resources ?? []) as { id: string; title: string }[];
  const recordings = (data?.recordings ?? []) as { id: string; title: string }[];
  const sections = (data?.sections ?? []) as { id: string; title: string }[];

  const submit = () => {
    const key = v.step_key || slugKey(v.title ?? "");
    if (!v.title?.trim()) return notify.error("Give the step a title.");
    if (!key) return notify.error("Give the step a title we can turn into an ID.");
    onSave({
      id: v.id,
      section_id: v.section_id ?? null,
      step_key: key,
      title: v.title,
      description: v.description ?? null,
      instructions: v.instructions ?? null,
      is_published: v.is_published ?? true,
      is_required: v.is_required ?? true,
      action_type: v.action_type ?? "none",
      action_url: v.action_url ?? null,
      internal_path: v.internal_path ?? null,
      course_id: v.course_id ?? null,
      resource_id: v.resource_id ?? null,
      recording_id: v.recording_id ?? null,
      button_label: v.button_label ?? null,
      completion_mode: v.completion_mode ?? "self",
      auto_course_id: v.auto_course_id ?? v.course_id ?? null,
      show_schedule: v.show_schedule ?? false,
      show_upline: v.show_upline ?? false,
    });
  };

  return (
    <Drawer title={isNew ? "Add step" : "Edit step"} onClose={onClose} width={620}>
      <FormGrid>
        <Field label="Step title">
          <Input value={v.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="Update Discord role" />
        </Field>
        <Field label="Short description" hint="One line agents see in the collapsed step.">
          <Textarea rows={2} value={v.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <Field label="Instructions" hint="Optional longer explanation shown when the step is opened.">
          <Textarea rows={4} value={v.instructions ?? ""} onChange={(e) => set({ instructions: e.target.value })} />
        </Field>
        <Field label="Section">
          <Select value={v.section_id ?? ""} onChange={(e) => set({ section_id: e.target.value || null })}>
            <option value="">No section</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Button" hint="What the agent opens to do this step.">
          <Select value={v.action_type ?? "none"} onChange={(e) => set({ action_type: e.target.value as any })}>
            {Object.entries(ACTION_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        {v.action_type === "external" && (
          <Field label="Link address">
            <Input value={v.action_url ?? ""} onChange={(e) => set({ action_url: e.target.value })} placeholder="https://…" />
          </Field>
        )}
        {v.action_type === "internal" && (
          <Field label="Portal page">
            <Select value={v.internal_path ?? ""} onChange={(e) => set({ internal_path: e.target.value })}>
              <option value="">Choose a page…</option>
              {INTERNAL_PAGES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {v.action_type === "course" && (
          <Field label="Course">
            <Select value={v.course_id ?? ""} onChange={(e) => set({ course_id: e.target.value || null })}>
              <option value="">Choose a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {v.action_type === "resource" && (
          <Field label="Library item">
            <Select value={v.resource_id ?? ""} onChange={(e) => set({ resource_id: e.target.value || null })}>
              <option value="">Choose an item…</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {v.action_type === "presentation" && (
          <Field label="Recording">
            <Select value={v.recording_id ?? ""} onChange={(e) => set({ recording_id: e.target.value || null })}>
              <option value="">Choose a recording…</option>
              {recordings.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {(v.action_type ?? "none") !== "none" && (
          <Field label="Button label" hint="Defaults to a sensible label when left blank.">
            <Input value={v.button_label ?? ""} onChange={(e) => set({ button_label: e.target.value })} placeholder="Open Discord" />
          </Field>
        )}

        <Field label="How it gets completed">
          <Select value={v.completion_mode ?? "self"} onChange={(e) => set({ completion_mode: e.target.value as any })}>
            {Object.entries(MODE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        {v.completion_mode === "auto" && (
          <Field label="Course that completes this step">
            <Select value={v.auto_course_id ?? v.course_id ?? ""} onChange={(e) => set({ auto_course_id: e.target.value || null })}>
              <option value="">Choose a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </FormGrid>

      <div className="mt-4 space-y-3">
        <Toggle checked={v.is_published ?? true} onChange={(b) => set({ is_published: b })} label="Published" description="Unpublished steps are hidden from agents." />
        <Toggle checked={v.is_required ?? true} onChange={(b) => set({ is_required: b })} label="Required" description="Required steps must all be done to finish onboarding." />
        <Toggle checked={v.show_schedule ?? false} onChange={(b) => set({ show_schedule: b })} label="Show the weekly schedule in this step" />
        <Toggle checked={v.show_upline ?? false} onChange={(b) => set({ show_upline: b })} label="Show the agent's upline and their details" />
        {!isNew && (
          <p className="p-muted text-[12px]">Step ID: {v.step_key} — this is what progress is saved against, so it can't be changed.</p>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="primary" loading={saving} onClick={submit}>
          Save step
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------- Schedule tab

function ScheduleTab({ items }: { items: ScheduleItemRow[] }) {
  const qc = useQueryClient();
  const save = useServerFn(saveScheduleItem);
  const del = useServerFn(deleteScheduleItem);
  const reorder = useServerFn(reorderOnboarding);
  const [editing, setEditing] = useState<Partial<ScheduleItemRow> | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["onboarding"] });
    qc.invalidateQueries({ queryKey: ["my-onboarding"] });
  };
  const saveMut = useMutation({
    mutationFn: (v: any) => save({ data: v }),
    onSuccess: () => {
      setEditing(null);
      refresh();
      notify.success("Schedule updated.");
    },
    onError: (e: any) => notify.error("Could not save that.", e?.message ?? "Please try again."),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      refresh();
      notify.success("Removed.");
    },
  });
  const moveMut = useMutation({
    mutationFn: (v: { id: string; direction: "up" | "down" }) =>
      reorder({ data: { table: "training_schedule_items", ...v } }),
    onSuccess: refresh,
  });

  return (
    <div className="space-y-4">
      <Panel>
        <p className="p-secondary leading-snug">
          This is the weekly schedule agents see during onboarding. Edit a time here and it changes everywhere it's shown.
        </p>
      </Panel>
      <Toolbar>
        <span className="p-label">{items.length} items</span>
        <ToolbarSpacer />
        <Button variant="primary" size="sm" onClick={() => setEditing({ label: "", when_text: "", note: "", is_active: true })}>
          <Plus size={14} /> Add item
        </Button>
      </Toolbar>
      <Panel padded={false}>
        <div className="divide-y" style={{ borderColor: "var(--p-border)" }}>
          {items.length === 0 && (
            <div className="px-4 py-6">
              <p className="p-secondary">Nothing on the schedule yet.</p>
            </div>
          )}
          {items.map((it) => (
            <div key={it.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="p-card-title">{it.label}</span>
                  <Badge tone="gold">{it.when_text}</Badge>
                  {!it.is_active && <Badge tone="neutral">Hidden</Badge>}
                </div>
                {it.note && <p className="p-secondary mt-1 leading-snug">{it.note}</p>}
              </div>
              <div className="flex flex-none items-center gap-1">
                <IconButton label="Move up" onClick={() => moveMut.mutate({ id: it.id, direction: "up" })}>
                  <ChevronUp size={15} />
                </IconButton>
                <IconButton label="Move down" onClick={() => moveMut.mutate({ id: it.id, direction: "down" })}>
                  <ChevronDown size={15} />
                </IconButton>
                <IconButton label="Edit" onClick={() => setEditing(it)}>
                  <Pencil size={15} />
                </IconButton>
                <IconButton
                  label="Delete"
                  onClick={() => {
                    if (confirm(`Remove "${it.label}" from the schedule?`)) delMut.mutate(it.id);
                  }}
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {editing && (
        <Drawer title={editing.id ? "Edit schedule item" : "Add schedule item"} onClose={() => setEditing(null)}>
          <FormGrid>
            <Field label="What it is">
              <Input value={editing.label ?? ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="Mandatory Team Meeting" />
            </Field>
            <Field label="When" hint="Written exactly as agents should read it.">
              <Input value={editing.when_text ?? ""} onChange={(e) => setEditing({ ...editing, when_text: e.target.value })} placeholder="Monday 9:00 AM" />
            </Field>
            <Field label="Note">
              <Textarea rows={2} value={editing.note ?? ""} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
            </Field>
          </FormGrid>
          <div className="mt-3">
            <Toggle checked={editing.is_active ?? true} onChange={(b) => setEditing({ ...editing, is_active: b })} label="Show to agents" />
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" loading={saveMut.isPending} onClick={() => saveMut.mutate(editing)}>
              Save
            </Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </Drawer>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Links tab

function LinksTab({ links }: { links: AppLinkRow[] }) {
  const qc = useQueryClient();
  const save = useServerFn(saveAppLink);
  const [editing, setEditing] = useState<Partial<AppLinkRow> | null>(null);
  const mut = useMutation({
    mutationFn: (v: any) => save({ data: v }),
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      notify.success("Link saved.");
    },
    onError: (e: any) => notify.error("Could not save that link.", e?.message ?? "Check the address and try again."),
  });

  return (
    <div className="space-y-4">
      <Panel>
        <p className="p-secondary leading-snug">
          The links used across onboarding, success pages and emails. Change one here and it updates everywhere.
        </p>
      </Panel>
      <Toolbar>
        <span className="p-label">{links.length} links</span>
        <ToolbarSpacer />
        <Button variant="primary" size="sm" onClick={() => setEditing({ key: "", label: "", url: "" })}>
          <Plus size={14} /> Add link
        </Button>
      </Toolbar>
      <Panel padded={false}>
        <div className="divide-y" style={{ borderColor: "var(--p-border)" }}>
          {links.map((l) => (
            <div key={l.key} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <span className="p-card-title">{l.label}</span>
                <p className="p-secondary mt-0.5 break-all">{l.url}</p>
                {l.description && <p className="p-muted mt-0.5 text-[12px]">{l.description}</p>}
              </div>
              <IconButton label="Edit" onClick={() => setEditing(l)}>
                <Pencil size={15} />
              </IconButton>
            </div>
          ))}
        </div>
      </Panel>

      {editing && (
        <Drawer title={editing.key ? "Edit link" : "Add link"} onClose={() => setEditing(null)}>
          <FormGrid>
            <Field label="Name">
              <Input value={editing.label ?? ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
            </Field>
            <Field label="Address">
              <Input value={editing.url ?? ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://…" />
            </Field>
            {!links.some((l) => l.key === editing.key) && (
              <Field label="ID" hint="Lowercase letters and underscores, e.g. team_calendar.">
                <Input value={editing.key ?? ""} onChange={(e) => setEditing({ ...editing, key: slugKey(e.target.value) })} />
              </Field>
            )}
            <Field label="What it's for">
              <Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>
          </FormGrid>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" loading={mut.isPending} onClick={() => mut.mutate(editing)}>
              Save link
            </Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </Drawer>
      )}
    </div>
  );
}
