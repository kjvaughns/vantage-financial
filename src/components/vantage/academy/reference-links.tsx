import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink, LayoutGrid, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Select } from "@/components/portal/ui";

export type RefLink = { label: string; kind: "external" | "internal"; url: string; note?: string | null };

const STATIC_PAGES: { label: string; url: string }[] = [
  { label: "Dashboard", url: "/portal" },
  { label: "Applicants", url: "/portal/applicants" },
  { label: "Tasks", url: "/portal/tasks" },
  { label: "Calendar", url: "/portal/calendar" },
  { label: "Leaderboard", url: "/portal/leaderboard" },
  { label: "Onboarding", url: "/portal/onboarding" },
  { label: "Academy", url: "/portal/academy" },
];

function usePortalPages() {
  return useQuery({
    queryKey: ["ref-link-pages"],
    staleTime: 60_000,
    queryFn: async () => {
      const s = supabase as any;
      const [c, l, r] = await Promise.all([
        s.from("courses").select("title, slug").eq("status", "published").not("slug", "is", null),
        s.from("library_resources").select("title, slug").eq("status", "published").not("slug", "is", null),
        s.from("recordings").select("title, slug").eq("status", "published").not("slug", "is", null),
      ]);
      return [
        ...STATIC_PAGES,
        ...(c.data ?? []).map((x: any) => ({ label: `Course: ${x.title}`, url: `/portal/academy/courses/${x.slug}` })),
        ...(l.data ?? []).map((x: any) => ({ label: `Library: ${x.title}`, url: `/portal/academy/library/${x.slug}` })),
        ...(r.data ?? []).map((x: any) => ({ label: `Recording: ${x.title}`, url: `/portal/academy/presentations/${x.slug}` })),
      ];
    },
  });
}

export function ReferenceLinksEditor({ value, onChange }: { value: RefLink[]; onChange: (v: RefLink[]) => void }) {
  const pages = usePortalPages().data ?? STATIC_PAGES;
  const update = (i: number, patch: Partial<RefLink>) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i: number, d: number) => {
    const n = [...value];
    const t = i + d;
    if (t < 0 || t >= n.length) return;
    [n[i], n[t]] = [n[t], n[i]];
    onChange(n);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="p-card-title">Reference links</div>
          <div className="p-muted">Extra links shown under the lesson. They open in a new tab.</div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={value.length >= 20}
          onClick={() => onChange([...value, { label: "", kind: "external", url: "", note: "" }])}
        >
          <Plus size={14} /> Add link
        </Button>
      </div>
      {value.map((l, i) => {
        const matched = pages.some((p) => p.url === l.url);
        return (
          <div key={i} className="p-panel space-y-2 p-3">
            <div className="flex gap-2">
              <Input className="flex-1" placeholder="Label, e.g. Product comparison sheet" value={l.label} onChange={(e) => update(i, { label: e.target.value })} />
              <Button size="sm" variant="ghost" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} /></Button>
              <Button size="sm" variant="ghost" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === value.length - 1}><ArrowDown size={14} /></Button>
              <Button size="sm" variant="ghost" aria-label="Remove link" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
              <Select value={l.kind} onChange={(e) => update(i, { kind: e.target.value as RefLink["kind"], url: "" })}>
                <option value="external">External website</option>
                <option value="internal">Page inside the portal</option>
              </Select>
              {l.kind === "external" ? (
                <Input placeholder="https://example.com" value={l.url} onChange={(e) => update(i, { url: e.target.value })} />
              ) : (
                <div className="space-y-2">
                  <Select value={matched ? l.url : "__custom"} onChange={(e) => update(i, { url: e.target.value === "__custom" ? "/portal/" : e.target.value })}>
                    <option value="" disabled>Choose a page…</option>
                    {pages.map((p) => <option key={p.url} value={p.url}>{p.label}</option>)}
                    <option value="__custom">Custom portal path…</option>
                  </Select>
                  {!matched && <Input placeholder="/portal/..." value={l.url} onChange={(e) => update(i, { url: e.target.value })} />}
                </div>
              )}
            </div>
            <Input placeholder="Optional note" value={l.note ?? ""} onChange={(e) => update(i, { note: e.target.value })} />
          </div>
        );
      })}
    </div>
  );
}

export function ReferenceLinksCard({ links }: { links: RefLink[] | null | undefined }) {
  const list = (links ?? []).filter((l) => l?.url && l?.label);
  if (!list.length) return null;
  return (
    <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--p-border)" }}>
      <div className="p-card-title mb-2">Reference links</div>
      <ul className="space-y-1.5">
        {list.map((l, i) => (
          <li key={i}>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-2 rounded-md p-2 hover:bg-[var(--p-hover)]">
              <span className="mt-0.5" style={{ color: "var(--p-gold)" }}>
                {l.kind === "internal" ? <LayoutGrid size={15} /> : <ExternalLink size={15} />}
              </span>
              <span>
                <span className="text-[13.5px] font-semibold group-hover:underline">{l.label}</span>
                {l.note && <span className="p-muted block">{l.note}</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

