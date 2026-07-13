"use client";

import { cn } from "@/lib/utils";
import type { MapLayerSettings } from "@/lib/map-layers";
import { Layers, MapPin, Shapes } from "lucide-react";

interface MapLayerControlsProps {
  settings: MapLayerSettings;
  onChange: (settings: MapLayerSettings) => void;
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs transition hover:bg-white/5",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-accent"
      />
    </label>
  );
}

export function MapLayerControls({ settings, onChange }: MapLayerControlsProps) {
  const patch = (partial: Partial<MapLayerSettings>) => {
    onChange({ ...settings, ...partial });
  };

  return (
    <div className="rounded-2xl border border-white/6 bg-card/60 p-3 backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2">
        <Layers className="h-4 w-4 text-accent" />
        <p className="text-xs font-semibold">Відображення карти</p>
      </div>

      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
        Міста
      </p>

      <div className="mb-3 flex rounded-lg border border-white/8 bg-white/3 p-0.5">
        <button
          type="button"
          onClick={() => patch({ cityDisplay: "boundaries" })}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-medium transition",
            settings.cityDisplay === "boundaries"
              ? "bg-accent/20 text-accent"
              : "text-muted hover:text-foreground"
          )}
        >
          <Shapes className="h-3 w-3" />
          Полігони
        </button>
        <button
          type="button"
          onClick={() => patch({ cityDisplay: "markers" })}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-medium transition",
            settings.cityDisplay === "markers"
              ? "bg-accent/20 text-accent"
              : "text-muted hover:text-foreground"
          )}
        >
          <MapPin className="h-3 w-3" />
          Мітки
        </button>
      </div>

      <ToggleRow
        label="Обводка міст"
        checked={settings.showCityOutline}
        disabled={settings.cityDisplay === "markers"}
        onChange={(showCityOutline) => patch({ showCityOutline })}
      />

      <div className="my-2 border-t border-white/6" />

      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
        Межі
      </p>

      <ToggleRow
        label="Країни"
        checked={settings.showCountryBorders}
        onChange={(showCountryBorders) => patch({ showCountryBorders })}
      />

      <ToggleRow
        label="Області / регіони"
        checked={settings.showRegionBorders}
        onChange={(showRegionBorders) => patch({ showRegionBorders })}
      />
    </div>
  );
}
