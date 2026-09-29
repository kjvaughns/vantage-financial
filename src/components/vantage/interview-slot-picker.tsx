import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Slot = { startIso: string };

const dayKeyFmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function InterviewSlotPicker({
  slots,
  value,
  onChange,
}: {
  slots: Slot[];
  value: string;
  onChange: (iso: string) => void;
}) {
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const key = dayKeyFmt(d);
      return { key, date: d, slots: slots.filter((s) => dayKeyFmt(new Date(s.startIso)) === key) };
    });
  }, [slots]);

  const initialDay = value
    ? dayKeyFmt(new Date(value))
    : (days.find((d) => d.slots.length > 0)?.key ?? days[0].key);
  const [dayKey, setDayKey] = useState(initialDay);
  const day = days.find((d) => d.key === dayKey) ?? days[0];

  const timeFmt = (iso: string, tz?: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  const selected = value ? new Date(value) : null;

  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-vantage-muted">
        1 · Pick a day
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-7 sm:overflow-visible">
        {days.map((d, i) => {
          const active = d.key === dayKey;
          const empty = d.slots.length === 0;
          return (
            <button
              key={d.key}
              type="button"
              disabled={empty}
              onClick={() => setDayKey(d.key)}
              className={cn(
                "flex min-w-[72px] shrink-0 flex-col items-center rounded-[12px] border px-2 py-2.5 transition",
                active
                  ? "border-vantage-gold bg-vantage-gold/15 text-vantage-ivory shadow-[0_0_20px_rgba(201,168,76,0.18)]"
                  : "border-vantage-gold/20 text-vantage-muted hover:border-vantage-gold/60 hover:text-vantage-ivory",
                empty && "cursor-not-allowed opacity-35 hover:border-vantage-gold/20",
              )}
            >
              <span className="text-[10.5px] font-semibold uppercase tracking-wider">
                {i === 0 ? "Today" : d.date.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span className="mt-0.5 text-[20px] font-semibold leading-none">{d.date.getDate()}</span>
              <span className="mt-1 text-[10px]">
                {d.date.toLocaleDateString("en-US", { month: "short" })} ·{" "}
                {empty ? "full" : `${d.slots.length} open`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-vantage-muted">
        2 · Pick a time{" "}
        <span className="normal-case tracking-normal text-vantage-faint">
          ({day.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })})
        </span>
      </div>
      {day.slots.length === 0 ? (
        <p className="text-[13px] text-vantage-muted">No open times this day — try another.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {day.slots.map((s) => {
            const active = s.startIso === value;
            return (
              <button
                key={s.startIso}
                type="button"
                onClick={() => onChange(s.startIso)}
                className={cn(
                  "rounded-full border px-3 py-2 text-[13px] font-medium transition",
                  active
                    ? "border-vantage-gold bg-vantage-gold text-vantage-card"
                    : "border-vantage-gold/35 text-vantage-ivory hover:border-vantage-gold hover:bg-vantage-gold/10",
                )}
              >
                {timeFmt(s.startIso)}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="mt-4 rounded-[12px] border border-vantage-gold/30 bg-vantage-gold/5 px-4 py-3 text-[13px] text-vantage-ivory">
          <span className="text-vantage-gold">✓</span>{" "}
          {selected.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at{" "}
          {timeFmt(value)} — 1:1 call with Vantage
          <span className="ml-1 text-vantage-muted">({timeFmt(value, "America/Chicago")} CT)</span>
        </div>
      )}
    </div>
  );
}
