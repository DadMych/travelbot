export interface MapLayerSettings {
  cityDisplay: "boundaries" | "markers";
  showCityOutline: boolean;
  showCountryBorders: boolean;
  showRegionBorders: boolean;
}

export const DEFAULT_MAP_LAYERS: MapLayerSettings = {
  cityDisplay: "boundaries",
  showCityOutline: true,
  showCountryBorders: true,
  showRegionBorders: true,
};

const STORAGE_KEY = "travel-map-layers-v2";

export function loadMapLayerSettings(): MapLayerSettings {
  if (typeof window === "undefined") return DEFAULT_MAP_LAYERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MAP_LAYERS;
    return { ...DEFAULT_MAP_LAYERS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_MAP_LAYERS;
  }
}

export function saveMapLayerSettings(settings: MapLayerSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
