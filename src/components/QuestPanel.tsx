"use client";

import type { Quest } from "@/lib/quests";
import { getAchievementIcon } from "@/lib/achievement-icons";
import { cn } from "@/lib/utils";
import { Check, Circle, MapPin } from "lucide-react";

interface QuestPanelProps {
  quests: Quest[];
}

export function QuestPanel({ quests }: QuestPanelProps) {
  const quest = quests[0];
  if (!quest) return null;

  const Icon = getAchievementIcon("Landmark");
  const pct = Math.round((quest.progress / quest.total) * 100);
  const remaining = quest.items.filter((i) => !i.visited);
  const done = quest.items.filter((i) => i.visited);

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Icon className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-medium">{quest.title}</h3>
        </div>
        <p className="text-xs leading-relaxed text-muted">{quest.description}</p>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] text-muted">
            <span>{quest.progress}/{quest.total} столиць</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {done.length > 0 && (
          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              Відвідано ({done.length})
            </p>
            <div className="space-y-1">
              {done.map((item) => (
                <QuestRow key={item.id} label={item.label} sub={item.matchedCity ?? item.country} done />
              ))}
            </div>
          </section>
        )}

        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Залишилось ({remaining.length})
          </p>
          <div className="space-y-1">
            {remaining.map((item) => (
              <QuestRow key={item.id} label={item.label} sub={item.country} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function QuestRow({
  label,
  sub,
  done = false,
}: {
  label: string;
  sub: string;
  done?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
        done ? "bg-emerald-500/8 text-emerald-100" : "bg-white/2 text-muted"
      )}
    >
      {done ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
      ) : (
        <Circle className="h-3.5 w-3.5 shrink-0 opacity-40" />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-medium", done && "text-foreground")}>{label}</p>
        <p className="truncate text-[10px] opacity-70">{sub}</p>
      </div>
      {done && <MapPin className="h-3 w-3 shrink-0 opacity-50" />}
    </div>
  );
}
