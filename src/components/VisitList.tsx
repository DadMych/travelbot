"use client";

import type { Visit } from "@/lib/db/schema";
import { cn, formatDate } from "@/lib/utils";
import { Calendar, MapPin, Star, Trash2 } from "lucide-react";

interface VisitListProps {
  visits: Visit[];
  selectedId?: string;
  onSelect: (visit: Visit) => void;
  onDelete?: (id: string) => void;
}

export function VisitList({ visits, selectedId, onSelect, onDelete }: VisitListProps) {
  if (visits.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
        <MapPin className="mx-auto mb-2 h-8 w-8 text-muted/50" />
        <p className="text-sm text-muted">Пока пусто</p>
        <p className="mt-1 text-xs text-muted/70">
          Напиши город в Telegram-боте
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 scrollbar-thin max-h-80 overflow-y-auto pr-1">
      {visits.map((visit) => (
        <VisitItem
          key={visit.id}
          visit={visit}
          selected={visit.id === selectedId}
          onSelect={() => onSelect(visit)}
          onDelete={onDelete ? () => onDelete(visit.id) : undefined}
        />
      ))}
    </div>
  );
}

function VisitItem({
  visit,
  selected,
  onSelect,
  onDelete,
}: {
  visit: Visit;
  selected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
        selected
          ? "border-accent/40 bg-accent/10"
          : "border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/4"
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15">
        <MapPin className="h-4 w-4 text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{visit.city}</p>
        <p className="truncate text-xs text-muted">
          {visit.country}
          {visit.region ? ` · ${visit.region}` : ""}
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(visit.visitedAt)}
          </span>
          {visit.rating && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {visit.rating}
            </span>
          )}
        </div>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 rounded-lg p-1.5 opacity-0 transition hover:bg-red-500/20 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </button>
      )}
    </button>
  );
}
