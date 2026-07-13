import type { Feature, FeatureCollection } from "geojson";
import type { Visit } from "@/lib/db/schema";
import { pointInGeometry } from "@/lib/point-in-polygon";

const COUNTRIES_GEOJSON_URL =
  "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";

const UA_OBLASTS_URL =
  "https://raw.githubusercontent.com/slawomirmatuszak/ukrainian_geodata/main/regiony.geojson";

let countriesGeoJson: FeatureCollection | null = null;
let ukraineOblasts: FeatureCollection | null = null;

async function loadCountriesGeoJson(): Promise<FeatureCollection> {
  if (countriesGeoJson) return countriesGeoJson;

  const response = await fetch(COUNTRIES_GEOJSON_URL, {
    next: { revalidate: 86_400 },
  });

  if (!response.ok) {
    return { type: "FeatureCollection", features: [] };
  }

  countriesGeoJson = (await response.json()) as FeatureCollection;
  return countriesGeoJson;
}

async function loadUkraineOblasts(): Promise<FeatureCollection> {
  if (ukraineOblasts) return ukraineOblasts;

  const response = await fetch(UA_OBLASTS_URL, {
    next: { revalidate: 86_400 },
  });

  if (!response.ok) {
    return { type: "FeatureCollection", features: [] };
  }

  ukraineOblasts = (await response.json()) as FeatureCollection;
  return ukraineOblasts;
}

function emptyCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

export async function getCountryBoundaries(visits: Visit[]): Promise<FeatureCollection> {
  const codes = new Set(visits.map((v) => v.countryCode));
  if (codes.size === 0) return emptyCollection();

  const all = await loadCountriesGeoJson();
  const features = all.features.filter((feature) => {
    const iso = feature.properties?.["ISO3166-1-Alpha-2"] as string | undefined;
    return iso && codes.has(iso);
  });

  return {
    type: "FeatureCollection",
    features: features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        label: (feature.properties?.name as string) ?? feature.properties?.["ISO3166-1-Alpha-2"],
        countryCode: feature.properties?.["ISO3166-1-Alpha-2"],
      },
    })),
  };
}

function featureKey(feature: Feature, fallback: string): string {
  const props = feature.properties ?? {};
  return String(
    props.fid ??
      props.region ??
      props.label ??
      props.shapeName ??
      props.name ??
      fallback
  );
}

async function getUkraineOblastBoundaries(visits: Visit[]): Promise<FeatureCollection> {
  const uaVisits = visits.filter((v) => v.countryCode === "UA");
  if (uaVisits.length === 0) return emptyCollection();

  const oblasts = await loadUkraineOblasts();
  const matched = new Map<string, Feature>();

  for (const visit of uaVisits) {
    for (const feature of oblasts.features) {
      if (!feature.geometry) continue;
      if (!pointInGeometry(visit.longitude, visit.latitude, feature.geometry)) continue;

      const key = featureKey(feature, visit.id);
      if (!matched.has(key)) {
        matched.set(key, {
          ...feature,
          properties: {
            ...feature.properties,
            label: feature.properties?.region ?? "Область",
            countryCode: "UA",
          },
        });
      }
      break;
    }
  }

  return { type: "FeatureCollection", features: [...matched.values()] };
}

export async function getRegionBoundaries(visits: Visit[]): Promise<FeatureCollection> {
  return getUkraineOblastBoundaries(visits);
}

export async function getAdminBoundaries(visits: Visit[]): Promise<{
  countries: FeatureCollection;
  regions: FeatureCollection;
}> {
  const [countries, regions] = await Promise.all([
    getCountryBoundaries(visits),
    getRegionBoundaries(visits),
  ]);

  return { countries, regions };
}
