import { useMemo, useState } from "react";
import { Badge, TYPE_META, formatDisplayDate, Overlay } from "./shared";
import { Toolbar, SearchField, SegmentedControl, EmptyState, Button } from "@/components/portal/ui";
import { isPreviewableDocument } from "@/lib/academy/media";
import { DocPreview } from "@/components/vantage/academy/doc-preview";

export type LibraryItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  long: string | null;
  url: string | null;
  cta: string | null;
  meta: string | null;
  tags: string[] | null;
  display_date: string | null;
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "video", label: "Videos" },
  { key: "pdf", label: "PDFs" },
  { key: "training", label: "Trainings" },
  { key: "guide", label: "Guides" },
];

export function LibraryView({ items }: { items: LibraryItem[] }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<LibraryItem | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const f of FILTERS) if (f.key !== "all") c[f.key] = items.filter((r) => r.type === f.key).length;
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((r) => {
      if (filter !== "all" && r.type !== filter) return false;
      if (!q) return true;
      const hay = (r.title + " " + (r.description ?? "") + " " + (r.tags ?? []).join(" ")).toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, query]);

  const visibleFilters = FILTERS.filter((f) => f.key === "all" || (counts[f.key] ?? 0) > 0);

  return (
    <>
      <Toolbar className="mb-4">
        <SearchField value={query} onChange={setQuery} placeholder="Search resources…" />
        <SegmentedControl
          size="sm"
          options={visibleFilters.map((f) => ({ value: f.key, label: `${f.label} (${counts[f.key] ?? 0})` }))}
          value={filter}
          onChange={setFilter}
        />
      </Toolbar>

      {visible.length === 0 ? (
        <EmptyState title="No resources found" description="Try a different search or filter." />
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {visible.map((it) => <Card key={it.id} item={it} onOpen={() => setActive(it)} />)}
        </div>
      )}

      {active && <ItemModal item={active} onClose={() => setActive(null)} />}
    </>
  );
}

function Card({ item, onOpen }: { item: LibraryItem; onOpen: () => void }) {
  const color = (TYPE_META[item.type] ?? TYPE_META.guide).color;
  return (
    <button
      onClick={onOpen}
      className="p-panel group relative flex flex-col gap-2 p-4 text-left transition hover:[border-color:var(--p-border-strong)]"
    >
      <span
        className="absolute inset-y-0 left-0 w-[3px] opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: color }}
      />
      <div className="flex items-center justify-between gap-2">
        <Badge type={item.type} />
        <span className="p-muted shrink-0">{formatDisplayDate(item.display_date)}</span>
      </div>
      <h3 className="p-card-title truncate">{item.title}</h3>
      <p className="p-secondary line-clamp-2">{item.description}</p>
      <div className="mt-auto flex items-center justify-between border-t pt-2.5" style={{ borderColor: "var(--p-border)" }}>
        <span className="p-muted truncate">{item.meta}</span>
        <span className="inline-flex items-center gap-1 text-[13px] font-semibold" style={{ color: "var(--p-gold)" }}>
          {item.cta ?? "Open"}
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </button>
  );
}

function ItemModal({ item, onClose }: { item: LibraryItem; onClose: () => void }) {
  const color = (TYPE_META[item.type] ?? TYPE_META.guide).color;
  return (
    <Overlay onClose={onClose}>
      <div className="p-panel relative p-4" style={{ borderTop: `2px solid ${color}` }}>
        <div className="flex items-center justify-between gap-3 pr-8">
          <Badge type={item.type} size="md" />
          <span className="p-muted">{formatDisplayDate(item.display_date)}</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-focus absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-[14px] hover:bg-[var(--p-hover)]"
          style={{ color: "var(--p-text-2)" }}
        >
          ✕
        </button>
        <h2 className="p-title mt-3">{item.title}</h2>
        <p className="p-secondary mt-3 leading-snug">{item.long || item.description}</p>
        {item.tags && item.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border px-2 py-0.5 text-[11.5px]"
                style={{ borderColor: "var(--p-border)", color: "var(--p-text-2)" }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
        {item.url && isPreviewableDocument(item.url) && (
          <div className="mt-4">
            <DocPreview url={item.url} title={item.title} height="h-[55vh]" />
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--p-border)" }}>
          <span className="p-muted">{item.meta}</span>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer">
              <Button variant="primary" size="sm">{item.cta ?? "Open"} →</Button>
            </a>
          ) : (
            <span className="p-muted">Link coming soon</span>
          )}
        </div>
      </div>
    </Overlay>
  );
}
