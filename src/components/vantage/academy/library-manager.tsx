import { useState } from "react";
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
  adminListLibraryV2,
  adminUpsertLibraryItem,
  adminSetLibraryStatus,
  LIBRARY_TYPES,
  LIBRARY_CATEGORIES,
} from "@/lib/academy-content.functions";
import { adminDeleteResource } from "@/lib/academy.functions";
import { adminDuplicateLibraryItem } from "@/lib/academy-templates.functions";
import { Plus, Trash2, Copy } from "lucide-react";

type Form = {
  title: string;
  description: string;
  type: (typeof LIBRARY_TYPES)[number];
  url: string;
  thumbnail_url: string;
  category: string;
  duration: string;
  is_required: boolean;
  featured: boolean;
  is_new: boolean;
  status: "draft" | "published";
};

const blank: Form = {
  title: "",
  description: "",
  type: "pdf",
  url: "",
  thumbnail_url: "",
  category: "",
  duration: "",
  is_required: false,
  featured: false,
  is_new: false,
  status: "draft",
};

export function LibraryManager() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListLibraryV2);
  const statusFn = useServerFn(adminSetLibraryStatus);
  const delFn = useServerFn(adminDeleteResource);
  const q = useQuery({ queryKey: ["academy", "admin", "library"], queryFn: () => listFn() });
  const [edit, setEdit] = useState<null | { id?: string }>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "published" | "draft">("all");

  const items = (q.data?.resources ?? []) as any[];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["academy", "admin", "library"] });

  const visible = items.filter((r) => {
    if (tab !== "all" && (r.status ?? "draft") !== tab) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${r.title} ${r.category ?? ""} ${r.type ?? ""}`.toLowerCase().includes(needle);
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
        title="Library"
        description="Documents, scripts, playbooks and quick-reference files."
        actions={
          <Button variant="primary" size="sm" onClick={() => setEdit({})}>
            <Plus size={14} /> New item
          </Button>
        }
        padded={false}
      >
        <div className="p-4 pb-0">
          <Toolbar>
            <SearchField value={query} onChange={setQuery} placeholder="Search the library…" />
            <SegmentedControl
              size="sm"
              value={tab}
              onChange={setTab}
              options={[
                { value: "all", label: `All (${items.length})` },
                { value: "published", label: "Published" },
                { value: "draft", label: "Drafts" },
              ]}
            />
          </Toolbar>
        </div>

        {q.isError ? (
          <ErrorState description="Couldn't load the library." onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            description="Add a document, script or playbook for your agents."
            action={<Button variant="primary" size="sm" onClick={() => setEdit({})}><Plus size={14} /> New item</Button>}
          />
        ) : (
          <TableWrap className="border-0">
            <Table>
              <THead>
                <TH>Title</TH>
                <TH>Type</TH>
                <TH>Category</TH>
                <TH>Status</TH>
                <TH align="right" />
              </THead>
              <tbody>
                {visible.map((r) => (
                  <TR key={r.id} onClick={() => setEdit({ id: r.id })}>
                    <TD className="p-card-title">
                      {r.title}
                      {r.is_required && <Badge tone="gold" className="ml-1.5">Required</Badge>}
                      {r.is_new && <Badge tone="blue" className="ml-1.5">New</Badge>}
                    </TD>
                    <TD><Badge tone="blue">{r.type}</Badge></TD>
                    <TD className="p-secondary">{r.category || "—"}</TD>
                    <TD><Badge tone={r.status === "published" ? "green" : "neutral"}>{r.status ?? "draft"}</Badge></TD>
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
                          aria-label="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this library item?")) act(() => delFn({ data: { id: r.id } }), "Item deleted.");
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
        <LibraryDrawer
          item={items.find((r) => r.id === edit.id)}
          onClose={() => setEdit(null)}
          onSaved={(id) => { invalidate(); setEdit({ id }); }}
        />
      )}
    </>
  );
}

function LibraryDrawer({ item, onClose, onSaved }: { item?: any; onClose: () => void; onSaved: (id: string) => void }) {
  const saveFn = useServerFn(adminUpsertLibraryItem);
  const [f, setF] = useState<Form>(
    item
      ? {
          title: item.title ?? "",
          description: item.description ?? "",
          type: (LIBRARY_TYPES.includes(item.type) ? item.type : "pdf") as Form["type"],
          url: item.url ?? "",
          thumbnail_url: item.thumbnail_url ?? "",
          category: item.category ?? "",
          duration: item.duration ?? "",
          is_required: !!item.is_required,
          featured: !!item.featured,
          is_new: !!item.is_new,
          status: (item.status ?? "draft") as "draft" | "published",
        }
      : blank,
  );
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const isMedia = f.type === "video" || f.type === "audio";

  async function save(status?: "draft" | "published") {
    if (!f.title.trim()) {
      notify.error("Add a title first.");
      return;
    }
    setBusy(true);
    try {
      const res = await saveFn({ data: { id: item?.id, ...f, status: status ?? f.status } });
      if (status) set("status", status);
      notify.success("Library item saved.");
      onSaved(res.id);
    } catch {
      notify.error("Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={item ? "Edit library item" : "New library item"}
      description={item?.slug ? `/portal/academy/library/${item.slug}` : "Library"}
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
          <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Final expense phone script" />
        </Field>
        <FormGrid>
          <Field label="Type">
            <Select value={f.type} onChange={(e) => set("type", e.target.value as Form["type"])}>
              {LIBRARY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={f.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Uncategorized</option>
              {LIBRARY_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </FormGrid>

        <MediaSourceField
          label={f.type === "link" ? "Link" : "File or link"}
          value={f.url}
          onChange={(url) => set("url", url)}
          folder="library"
          hint={f.type === "link" ? "Paste the destination URL." : "Upload the file or paste a link to it."}
        />

        <FormGrid>
          <Field label="Duration / length" hint="Optional, e.g. 8:20 or 4 pages.">
            <Input value={f.duration} onChange={(e) => set("duration", e.target.value)} />
          </Field>
          <Field label="Thumbnail URL">
            <Input value={f.thumbnail_url} onChange={(e) => set("thumbnail_url", e.target.value)} placeholder="https://…" />
          </Field>
        </FormGrid>
        <Field label="Description">
          <Textarea rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <div className="space-y-3 rounded-[10px] p-3" style={{ background: "var(--p-hover)" }}>
          <Toggle checked={f.is_required} onChange={(v) => set("is_required", v)} label="Required reading" />
          <Toggle checked={f.featured} onChange={(v) => set("featured", v)} label="Feature on the Academy home" />
          <Toggle checked={f.is_new} onChange={(v) => set("is_new", v)} label="Show a NEW badge" />
        </div>

        {item?.id && isMedia && <TranscriptPanel ownerType="library" ownerId={item.id} sourceUrl={f.url} />}
      </div>
    </Drawer>
  );
}
