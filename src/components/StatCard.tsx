"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: string;
}

export function StatCard({ label, value, icon: Icon, accent = "text-accent" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/2 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", accent)} />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
