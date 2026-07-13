"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Popup,
  Source,
} from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import type { FeatureCollection } from "geojson";
import type { Visit } from "@/lib/db/schema";
import { geometryBBox, visitsToFeatureCollection } from "@/lib/geojson";
import type { MapLayerSettings } from "@/lib/map-layers";
import { formatDate } from "@/lib/utils";
import { Calendar, MapPin, X } from "lucide-react";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

interface AdminBoundaries {
  countries: FeatureCollection;
  regions: FeatureCollection;
}

interface TravelMapProps {
  visits: Visit[];
  selectedId?: string;
  onSelectVisit?: (visit: Visit | null) => void;
  layerSettings: MapLayerSettings;
  adminBoundaries?: AdminBoundaries;
}

export function TravelMap({
  visits,
  selectedId,
  onSelectVisit,
  layerSettings,
  adminBoundaries,
}: TravelMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [popupVisit, setPopupVisit] = useState<Visit | null>(null);

  const boundaries = adminBoundaries ?? { countries: EMPTY_FC, regions: EMPTY_FC };

  const selectedVisit = useMemo(
    () => visits.find((v) => v.id === selectedId) ?? null,
    [visits, selectedId]
  );

  const showBoundaries = layerSettings.cityDisplay === "boundaries";

  const visitsWithBoundary = useMemo(
    () => (showBoundaries ? visits.filter((v) => v.boundary) : []),
    [visits, showBoundaries]
  );

  const markerVisits = useMemo(() => {
    if (layerSettings.cityDisplay === "markers") return visits;
    return visits.filter((v) => !v.boundary);
  }, [visits, layerSettings.cityDisplay]);

  const boundaryData = useMemo(
    () => visitsToFeatureCollection(visitsWithBoundary, selectedId),
    [visitsWithBoundary, selectedId]
  );

  const viewState = useMemo(() => {
    if (selectedVisit?.boundary && showBoundaries) {
      const bbox = geometryBBox(selectedVisit.boundary);
      if (bbox) {
        return {
          bounds: [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ] as [[number, number], [number, number]],
          fitBoundsOptions: { padding: 48, maxZoom: 11 },
        };
      }
    }

    if (selectedVisit) {
      return {
        longitude: selectedVisit.longitude,
        latitude: selectedVisit.latitude,
        zoom: 10,
      };
    }

    if (visits.length === 0) {
      return { longitude: 20, latitude: 30, zoom: 1.5 };
    }

    const lngs = visits.map((v) => v.longitude);
    const lats = visits.map((v) => v.latitude);
    return {
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      zoom: visits.length === 1 ? 8 : 2,
    };
  }, [visits, selectedVisit, showBoundaries]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !selectedVisit) return;

    if (selectedVisit.boundary && showBoundaries) {
      const bbox = geometryBBox(selectedVisit.boundary);
      if (bbox) {
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 48, duration: 800, maxZoom: 11 }
        );
        return;
      }
    }

    map.flyTo({
      center: [selectedVisit.longitude, selectedVisit.latitude],
      zoom: 10,
      duration: 800,
    });
  }, [selectedVisit, showBoundaries]);

  const handleVisitClick = useCallback(
    (visit: Visit) => {
      setPopupVisit(visit);
      onSelectVisit?.(visit);
    },
    [onSelectVisit]
  );

  const activePopup = popupVisit ?? (selectedVisit && !popupVisit ? selectedVisit : null);

  const initialViewState =
    "bounds" in viewState
      ? { longitude: 20, latitude: 30, zoom: 2 }
      : viewState;

  const interactiveLayerIds =
    showBoundaries && visitsWithBoundary.length > 0 ? ["city-fill"] : undefined;

  const showCountries =
    layerSettings.showCountryBorders && boundaries.countries.features.length > 0;
  const showRegions =
    layerSettings.showRegionBorders && boundaries.regions.features.length > 0;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/8">
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        attributionControl={false}
        reuseMaps
        interactiveLayerIds={interactiveLayerIds}
        onClick={(e) => {
          const feature = e.features?.[0];
          const visitId = feature?.properties?.visitId as string | undefined;
          if (!visitId) return;
          const visit = visits.find((v) => v.id === visitId);
          if (visit) handleVisitClick(visit);
        }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {showCountries && (
          <Source id="country-boundaries" type="geojson" data={boundaries.countries}>
            <Layer
              id="country-fill"
              type="fill"
              paint={{
                "fill-color": "#fbbf24",
                "fill-opacity": 0.04,
              }}
            />
            <Layer
              id="country-outline"
              type="line"
              paint={{
                "line-color": "#fcd34d",
                "line-width": 2.5,
                "line-opacity": 0.85,
              }}
            />
          </Source>
        )}

        {showRegions && (
          <Source id="region-boundaries" type="geojson" data={boundaries.regions}>
            <Layer
              id="region-fill"
              type="fill"
              paint={{
                "fill-color": "#a78bfa",
                "fill-opacity": 0.14,
              }}
            />
            <Layer
              id="region-outline"
              type="line"
              paint={{
                "line-color": "#ddd6fe",
                "line-width": 2.5,
                "line-opacity": 0.95,
              }}
            />
          </Source>
        )}

        {showBoundaries && boundaryData.features.length > 0 && (
          <Source id="city-boundaries" type="geojson" data={boundaryData}>
            <Layer
              id="city-fill"
              type="fill"
              paint={{
                "fill-color": [
                  "case",
                  ["==", ["get", "selected"], 1],
                  "#60a5fa",
                  "#3b82f6",
                ],
                "fill-opacity": [
                  "case",
                  ["==", ["get", "selected"], 1],
                  0.65,
                  0.5,
                ],
              }}
            />
            {layerSettings.showCityOutline && (
              <Layer
                id="city-outline"
                type="line"
                paint={{
                  "line-color": [
                    "case",
                    ["==", ["get", "selected"], 1],
                    "#ffffff",
                    "#bfdbfe",
                  ],
                  "line-width": [
                    "case",
                    ["==", ["get", "selected"], 1],
                    3.5,
                    2.5,
                  ],
                  "line-opacity": 1,
                }}
              />
            )}
            <Layer
              id="city-labels"
              type="symbol"
              layout={{
                "text-field": ["get", "city"],
                "text-size": 11,
                "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
                "text-anchor": "center",
                "text-allow-overlap": false,
              }}
              paint={{
                "text-color": "#e2e8f0",
                "text-halo-color": "#0f172a",
                "text-halo-width": 1.5,
              }}
            />
          </Source>
        )}

        {markerVisits.map((visit) => (
          <Marker
            key={visit.id}
            longitude={visit.longitude}
            latitude={visit.latitude}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleVisitClick(visit);
            }}
          >
            <div className="map-marker relative flex items-center justify-center">
              {visit.id === selectedId && (
                <span className="pulse-ring absolute h-8 w-8 rounded-full bg-accent/40" />
              )}
              <div
                className={`relative flex h-7 w-7 items-center justify-center rounded-full shadow-lg ring-2 ring-white/20 ${
                  visit.id === selectedId
                    ? "bg-accent scale-110"
                    : "bg-accent/80 hover:bg-accent"
                }`}
              >
                <MapPin className="h-3.5 w-3.5 text-white" fill="white" />
              </div>
            </div>
          </Marker>
        ))}

        {activePopup && (
          <Popup
            longitude={activePopup.longitude}
            latitude={activePopup.latitude}
            anchor="bottom"
            offset={12}
            closeButton={false}
            onClose={() => {
              setPopupVisit(null);
              onSelectVisit?.(null);
            }}
            maxWidth="280px"
          >
            <div className="p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{activePopup.city}</h3>
                  <p className="text-xs text-muted">
                    {activePopup.country}
                    {activePopup.region ? ` · ${activePopup.region}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPopupVisit(null);
                    onSelectVisit?.(null);
                  }}
                  className="rounded-lg p-1 hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5 text-muted" />
                </button>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted">
                <Calendar className="h-3 w-3" />
                {formatDate(activePopup.visitedAt)}
              </div>
              {activePopup.notes && (
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {activePopup.notes}
                </p>
              )}
            </div>
          </Popup>
        )}
      </Map>

      <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-white/10 bg-card/90 px-2.5 py-1.5 text-[10px] text-muted backdrop-blur-md">
        {showCountries && `${boundaries.countries.features.length} країн · `}
        {showRegions && `${boundaries.regions.features.length} областей · `}
        {showBoundaries && `${visitsWithBoundary.length} міст`}
      </div>

      {visits.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="rounded-2xl border border-white/10 bg-card/90 px-6 py-4 text-center backdrop-blur-md">
            <MapPin className="mx-auto mb-2 h-6 w-6 text-accent" />
            <p className="text-sm font-medium">Карта чекає перше місце</p>
            <p className="mt-1 text-xs text-muted">Додай через Telegram-бота</p>
          </div>
        </div>
      )}
    </div>
  );
}
