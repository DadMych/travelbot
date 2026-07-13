"use client";

import { useCallback, useMemo, useState } from "react";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/maplibre";
import type { Visit } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";
import { Calendar, MapPin, X } from "lucide-react";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

interface TravelMapProps {
  visits: Visit[];
  selectedId?: string;
  onSelectVisit?: (visit: Visit | null) => void;
}

export function TravelMap({ visits, selectedId, onSelectVisit }: TravelMapProps) {
  const [popupVisit, setPopupVisit] = useState<Visit | null>(null);

  const selectedVisit = useMemo(
    () => visits.find((v) => v.id === selectedId) ?? null,
    [visits, selectedId]
  );

  const viewState = useMemo(() => {
    if (selectedVisit) {
      return {
        longitude: selectedVisit.longitude,
        latitude: selectedVisit.latitude,
        zoom: 8,
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
      zoom: visits.length === 1 ? 6 : 2,
    };
  }, [visits, selectedVisit]);

  const handleMarkerClick = useCallback(
    (visit: Visit) => {
      setPopupVisit(visit);
      onSelectVisit?.(visit);
    },
    [onSelectVisit]
  );

  const activePopup = popupVisit ?? (selectedVisit && !popupVisit ? selectedVisit : null);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/8">
      <Map
        initialViewState={viewState}
        {...(selectedVisit
          ? {
              longitude: selectedVisit.longitude,
              latitude: selectedVisit.latitude,
              zoom: 8,
            }
          : {})}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        attributionControl={false}
        reuseMaps
      >
        <NavigationControl position="top-right" showCompass={false} />

        {visits.map((visit) => (
          <Marker
            key={visit.id}
            longitude={visit.longitude}
            latitude={visit.latitude}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(visit);
            }}
          >
            <div className="map-marker relative flex items-center justify-center">
              {visit.id === selectedId && (
                <span className="pulse-ring absolute h-8 w-8 rounded-full bg-accent/40" />
              )}
              <div
                className={`relative flex h-8 w-8 items-center justify-center rounded-full shadow-lg ring-2 ring-white/20 ${
                  visit.id === selectedId
                    ? "bg-accent scale-110"
                    : "bg-accent/80 hover:bg-accent"
                }`}
              >
                <MapPin className="h-4 w-4 text-white" fill="white" />
              </div>
            </div>
          </Marker>
        ))}

        {activePopup && (
          <Popup
            longitude={activePopup.longitude}
            latitude={activePopup.latitude}
            anchor="bottom"
            offset={20}
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

      {visits.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="rounded-2xl border border-white/10 bg-card/90 px-6 py-4 text-center backdrop-blur-md">
            <MapPin className="mx-auto mb-2 h-6 w-6 text-accent" />
            <p className="text-sm font-medium">Карта ждёт первое место</p>
            <p className="mt-1 text-xs text-muted">Добавь через Telegram-бота</p>
          </div>
        </div>
      )}
    </div>
  );
}
