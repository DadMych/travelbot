"use client";

import type { TimelineBucket } from "@/lib/quests";
import { cn } from "@/lib/utils";

export type TimelineSelection = {
  year: number | null | "all";
  month: number | null;
};

interface TimelineFilterProps {
  timeline: TimelineBucket[];
  selection: TimelineSelection;
  onChange: (selection: TimelineSelection) => void;
}

export function TimelineFilter({ timeline, selection, onChange }: TimelineFilterProps) {
  const activeYear = timeline.find((b) =>
    selection.year === "all"
      ? false
      : selection.year === null
        ? b.year === null
        : b.year === selection.year
  );

  return (
    <div className="rounded-2xl border border-white/6 bg-card/60 p-3 backdrop-blur-sm">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
        Таймлайн
      </p>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={selection.year === "all" && selection.month == null}
          onClick={() => onChange({ year: "all", month: null })}
          label="Усі"
        />
        {timeline.map((bucket) => (
          <FilterChip
            key={bucket.label}
            active={
              selection.year !== "all" &&
              selection.year === bucket.year &&
              selection.month == null
            }
            onClick={() => onChange({ year: bucket.year, month: null })}
            label={`${bucket.label} (${bucket.count})`}
          />
        ))}
      </div>

      {activeYear && activeYear.months.length > 0 && activeYear.year != null && (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-white/6 pt-2">
          <FilterChip
            active={selection.month == null}
            onClick={() => onChange({ year: activeYear.year, month: null })}
            label="Весь рік"
            small
          />
          {activeYear.months.map((m) => (
            <FilterChip
              key={m.month}
              active={selection.month === m.month}
              onClick={() => onChange({ year: activeYear.year, month: m.month })}
              label={`${m.label} (${m.count})`}
              small
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  small = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border transition",
        small ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]",
        active
          ? "border-accent/40 bg-accent/15 text-accent"
          : "border-white/8 bg-white/3 text-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
