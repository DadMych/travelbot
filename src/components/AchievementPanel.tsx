"use client";

import type { Achievement } from "@/lib/achievements";
import { TIER_COLORS } from "@/lib/achievements";
import { cn } from "@/lib/utils";
import { Lock, Trophy } from "lucide-react";

interface AchievementPanelProps {
  achievements: Achievement[];
}

export function AchievementPanel({ achievements }: AchievementPanelProps) {
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <h3 className="text-sm font-medium">Ачивки</h3>
        </div>
        <span className="text-xs text-muted">
          {unlocked.length}/{achievements.length}
        </span>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {unlocked.map((achievement) => (
          <AchievementCard key={achievement.id} achievement={achievement} />
        ))}
        {locked.map((achievement) => (
          <AchievementCard key={achievement.id} achievement={achievement} dimmed />
        ))}
      </div>
    </div>
  );
}

function AchievementCard({
  achievement,
  dimmed = false,
}: {
  achievement: Achievement;
  dimmed?: boolean;
}) {
  const Icon = achievement.icon;
  const tierClass = TIER_COLORS[achievement.tier];
  const progressPct = Math.round((achievement.progress / achievement.target) * 100);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 transition",
        achievement.unlocked
          ? tierClass
          : "border-white/4 bg-white/2",
        dimmed && !achievement.unlocked && "opacity-55"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          achievement.unlocked ? "bg-white/10" : "bg-white/5"
        )}
      >
        {achievement.unlocked ? (
          <Icon className="h-4 w-4" />
        ) : (
          <Lock className="h-3.5 w-3.5 text-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{achievement.title}</p>
        <p className="mt-0.5 text-xs text-muted line-clamp-2">{achievement.description}</p>
        {!achievement.unlocked && (
          <div className="mt-2">
            <div className="h-1 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-accent/60 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-muted">
              {achievement.progress}/{achievement.target}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
