import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Compass, Loader2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchRecruiters, type RecruiterOption } from "@/lib/applications.functions";

export type RecruiterSelection = RecruiterOption & { custom?: boolean; self?: boolean };

/** Sentinel selection for "nobody referred me — I found Vantage on my own". */
export const SELF_REFERRAL: RecruiterSelection = {
  id: "",
  full_name: "I found Vantage on my own",
  avatar_url: null,
  recruiting_slug: null,
  team_name: null,
  self: true,
};

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Avatar({ r }: { r: RecruiterSelection }) {
  if (r.self) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-vantage-gold/40 bg-vantage-gold/10 text-vantage-gold">
        <Compass className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (r.avatar_url) {
    return <img src={r.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-vantage-fog">
      {initials(r.full_name)}
    </span>
  );
}

export function RecruiterCombobox({
  value,
  onChange,
  invalid,
}: {
  value: RecruiterSelection | null;
  onChange: (r: RecruiterSelection | null) => void;
  invalid?: boolean;
}) {
  const search = useServerFn(searchRecruiters);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecruiterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(() => {
      search({ data: { q: query.trim() } })
        .then((rows) => {
          if (id === reqId.current) setResults(rows);
        })
        .catch(() => {
          if (id === reqId.current) setResults([]);
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, search]);

  const trimmed = query.trim();
  const canAddCustom =
    trimmed.length >= 2 &&
    !results.some((r) => (r.full_name ?? "").toLowerCase() === trimmed.toLowerCase());

  function pickCustom() {
    onChange({
      id: "",
      full_name: trimmed,
      avatar_url: null,
      recruiting_slug: null,
      team_name: null,
      custom: true,
    });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className={cn(
            "vantage-input flex items-center justify-between gap-2 text-left",
            invalid && "border-red-500/60",
          )}
        >
          {value ? (
            <span className="flex min-w-0 items-center gap-2">
              <Avatar r={value} />
              <span className="truncate text-vantage-ivory">
                {value.full_name}
                {value.custom && (
                  <span className="ml-2 text-[11px] font-medium text-vantage-gold">Not on platform yet</span>
                )}
              </span>
            </span>
          ) : (
            <span className="text-vantage-faint">Search for your recruiter…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-vantage-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0"
        style={{
          background: "var(--p-panel, #141416)",
          borderColor: "var(--p-border, rgba(255,255,255,0.08))",
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a first or last name…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-72 overflow-y-auto">
            <CommandGroup heading="No one referred you?">
              <CommandItem
                value="__self__"
                onSelect={() => {
                  onChange(SELF_REFERRAL);
                  setOpen(false);
                }}
                className="gap-2"
              >
                <Avatar r={SELF_REFERRAL} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-vantage-ivory">I found Vantage on my own</span>
                  <span className="truncate text-[12px] text-vantage-faint">
                    Pick this if you messaged us or found us online — don't guess a name
                  </span>
                </span>
                {value?.self && <Check className="ml-auto h-4 w-4 text-vantage-gold" />}
              </CommandItem>
            </CommandGroup>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-vantage-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            ) : (
              <>
                {results.length > 0 && (
                  <CommandGroup heading="Active Vantage agents">
                    {results.map((r) => (
                      <CommandItem
                        key={r.id}
                        value={r.id}
                        onSelect={() => {
                          onChange({ ...r, custom: false });
                          setOpen(false);
                        }}
                        className="gap-2"
                      >
                        <Avatar r={r} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-vantage-ivory">{r.full_name}</span>
                          {r.team_name && (
                            <span className="truncate text-[12px] text-vantage-faint">{r.team_name}</span>
                          )}
                        </span>
                        {value?.id === r.id && !value.custom && (
                          <Check className="ml-auto h-4 w-4 text-vantage-gold" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {canAddCustom && (
                  <CommandGroup heading="Not seeing them?">
                    <CommandItem value={`__add__${trimmed}`} onSelect={pickCustom} className="gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-vantage-gold/40 bg-vantage-gold/10 text-vantage-gold">
                        <UserPlus className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-vantage-ivory">Add "{trimmed}"</span>
                        <span className="truncate text-[12px] text-vantage-faint">
                          We'll follow up to link them to your application
                        </span>
                      </span>
                    </CommandItem>
                  </CommandGroup>
                )}
                {results.length === 0 && !canAddCustom && (
                  <div className="py-6 text-center text-sm text-vantage-muted">
                    {trimmed.length < 2 ? "Start typing a name…" : "Type a full name to add them"}
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
