"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Visit } from "@/lib/db/schema";
import type { Achievement, TravelStats } from "@/lib/achievements";
import type { Quest, TimelineBucket } from "@/lib/quests";
import { filterVisitsByTimeline } from "@/lib/quests";
import type { TravelStatus } from "@/lib/settings";
import { AchievementPanel } from "@/components/AchievementPanel";
import { MapLayerControls } from "@/components/MapLayerControls";
import { QuestPanel } from "@/components/QuestPanel";
import { StatCard } from "@/components/StatCard";
import { TimelineFilter, type TimelineSelection } from "@/components/TimelineFilter";
import { TravelStatusBar } from "@/components/TravelStatusBar";
import { VisitList } from "@/components/VisitList";
import { cn } from "@/lib/utils";
import {
  DEFAULT_MAP_LAYERS,
  loadMapLayerSettings,
  saveMapLayerSettings,
  type MapLayerSettings,
} from "@/lib/map-layers";
import {
  Compass,
  Globe,
  LayoutGrid,
  Loader2,
  Map as MapIcon,
  MapPin,
  RefreshCw,
  Trophy,
} from "lucide-react";

const TravelMap = dynamic(
  () => import("@/components/TravelMap").then((m) => m.TravelMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-2xl border border-white/8 bg-card/50">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    ),
  }
);

type Tab = "places" | "quests" | "achievements";

interface DashboardData {
  visits: Visit[];
  stats: TravelStats;
  achievements: Achievement[];
  quests: Quest[];
  timeline: TimelineBucket[];
  settings: { travelStatus: TravelStatus; updatedAt: string };
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [tab, setTab] = useState<Tab>("places");
  const [refreshing, setRefreshing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [mapLayers, setMapLayers] = useState<MapLayerSettings>(DEFAULT_MAP_LAYERS);
  const [timelineSelection, setTimelineSelection] = useState<TimelineSelection>({
    year: "all",
    month: null,
  });

  useEffect(() => {
    setMapLayers(loadMapLayerSettings());
  }, []);

  const handleMapLayersChange = useCallback((settings: MapLayerSettings) => {
    setMapLayers(settings);
    saveMapLayerSettings(settings);
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      const res = await fetch("/api/visits", { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError("Не вдалося завантажити дані. Перевір DATABASE_URL.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm("Прибрати це місце з карти?")) return;
    await fetch(`/api/visits/${id}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId(undefined);
    fetchData(true);
  };

  const handleToggleStatus = async () => {
    if (!data) return;
    setStatusLoading(true);
    const next: TravelStatus = data.settings.travelStatus === "home" ? "away" : "home";
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ travelStatus: next }),
      });
      if (!res.ok) throw new Error("Failed");
      const settings = await res.json();
      setData({ ...data, settings });
    } finally {
      setStatusLoading(false);
    }
  };

  const filteredVisits = useMemo(() => {
    if (!data) return [];
    return filterVisitsByTimeline(
      data.visits,
      timelineSelection.year,
      timelineSelection.month
    );
  }, [data, timelineSelection]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-4">
        <MapIcon className="h-12 w-12 text-muted" />
        <p className="text-muted">{error}</p>
        <button
          type="button"
          onClick={() => fetchData()}
          className="rounded-xl bg-accent px-4 py-2 text-sm text-white"
        >
          Спробувати знову
        </button>
      </div>
    );
  }

  const { stats, achievements, quests, timeline, settings } = data;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const questProgress = quests[0]?.progress ?? 0;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_#0f172a_0%,_#070b14_50%)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/6 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 ring-1 ring-accent/25">
            <Globe className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Travel Map</h1>
            <p className="text-xs text-muted">Карта подорожей</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TravelStatusBar
            status={settings.travelStatus}
            onToggle={handleToggleStatus}
            loading={statusLoading}
          />
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-xs text-muted transition hover:bg-white/8 hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Оновити
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-[340px_1fr] md:p-6">
        <aside className="flex min-h-0 flex-col gap-4 overflow-hidden md:max-h-full">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Місця" value={stats.totalVisits} icon={MapPin} />
            <StatCard label="Міста" value={stats.uniqueCities} icon={LayoutGrid} accent="text-emerald-400" />
            <StatCard label="Країни" value={stats.uniqueCountries} icon={Globe} accent="text-violet-400" />
            <StatCard label="Столиці" value={questProgress} icon={Compass} accent="text-sky-400" />
          </div>

          <TimelineFilter
            timeline={timeline}
            selection={timelineSelection}
            onChange={setTimelineSelection}
          />

          <MapLayerControls settings={mapLayers} onChange={handleMapLayersChange} />

          <div className="flex rounded-xl border border-white/6 bg-white/2 p-1">
            <TabButton active={tab === "places"} onClick={() => setTab("places")} icon={MapPin} label="Місця" />
            <TabButton active={tab === "quests"} onClick={() => setTab("quests")} icon={Compass} label="Квести" />
            <TabButton active={tab === "achievements"} onClick={() => setTab("achievements")} icon={Trophy} label="Ачивки" />
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/6 bg-card/60 p-4 backdrop-blur-sm">
            {tab === "places" && (
              <VisitList
                visits={filteredVisits}
                selectedId={selectedId}
                onSelect={(v) => setSelectedId(v.id)}
                onDelete={handleDelete}
              />
            )}
            {tab === "quests" && <QuestPanel quests={quests} />}
            {tab === "achievements" && <AchievementPanel achievements={achievements} />}
          </div>
        </aside>

        <main className="min-h-[300px] md:min-h-0">
          <TravelMap
            visits={filteredVisits}
            selectedId={selectedId}
            onSelectVisit={(v) => setSelectedId(v?.id)}
            layerSettings={mapLayers}
          />
        </main>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MapPin;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-medium transition",
        active ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
