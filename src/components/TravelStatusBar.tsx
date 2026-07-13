"use client";

import type { TravelStatus } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Home, Plane } from "lucide-react";

interface TravelStatusBarProps {
  status: TravelStatus;
  onToggle: () => void;
  loading?: boolean;
}

export function TravelStatusBar({ status, onToggle, loading }: TravelStatusBarProps) {
  const isAway = status === "away";

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium",
          isAway
            ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
        )}
      >
        {isAway ? (
          <Plane className="h-3.5 w-3.5" />
        ) : (
          <Home className="h-3.5 w-3.5" />
        )}
        {isAway ? "В подорожі" : "Вдома"}
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={loading}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted transition hover:bg-white/10 hover:text-foreground disabled:opacity-50"
      >
        {isAway ? "→ Вдома" : "→ В подорожі"}
      </button>
    </div>
  );
}
