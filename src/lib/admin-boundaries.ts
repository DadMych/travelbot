import type { Feature, FeatureCollection } from "geojson";
import type { Visit } from "@/lib/db/schema";
import { getCachedDataset, getCachedMatchedRegions } from "@/lib/boundary-cache";
import { pointInGeometry } from "@/lib/point-in-polygon";
import { createHash } from "crypto";

const COUNTRIES_GEOJSON_URL =
  "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";

const UA_OBLASTS_URL =
  "https://raw.githubusercontent.com/slawomirmatuszak/ukrainian_geodata/main/regiony.geojson";

const ADMIN1_STATES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";

async function fetchGeoJson(url: string): Promise<FeatureCollection> {
  const response = await fetch(url, { next: { revalidate: 86_400 } });
  if (!response.ok) {
    return { type: "FeatureCollection", features: [] };
  }
  return (await response.json()) as FeatureCollection;
}

function emptyCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function featureKey(feature: Feature, fallback: string): string {
  const props = feature.properties ?? {};
  return String(
    props.fid ??
      props.region ??
      props.label ??
      props.name ??
      props.shapeName ??
      fallback
  );
}

function visitsHash(visits: Visit[]): string {
  const payload = visits
    .map((v) => `${v.id}:${v.latitude}:${v.longitude}:${v.countryCode}`)
    .sort()
    .join("|");
  return createHash("sha1").update(payload).digest("hex").slice(0, 16);
}

function matchRegionsForVisits(
  visits: Visit[],
  regions: FeatureCollection,
  filter: (visit: Visit, feature: Feature) => boolean,
  labelFrom: (feature: Feature) => string
): FeatureCollection {
  const matched = new Map<string, Feature>();

  for (const visit of visits) {
    for (const feature of regions.features) {
      if (!feature.geometry) continue;
      if (!filter(visit, feature)) continue;
      if (!pointInGeometry(visit.longitude, visit.latitude, feature.geometry)) continue;

      const key = featureKey(feature, visit.id);
      if (!matched.has(key)) {
        matched.set(key, {
          ...feature,
          properties: {
            ...feature.properties,
            label: labelFrom(feature),
            countryCode: visit.countryCode,
          },
        });
      }
      break;
    }
  }

  return { type: "FeatureCollection", features: [...matched.values()] };
}

export async function getCountryBoundaries(visits: Visit[]): Promise<FeatureCollection> {
  const codes = new Set(visits.map((v) => v.countryCode));
  if (codes.size === 0) return emptyCollection();

  const all = await getCachedDataset("dataset:countries", "dataset", () =>
    fetchGeoJson(COUNTRIES_GEOJSON_URL)
  );

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

async function getUkraineOblastBoundaries(visits: Visit[]): Promise<FeatureCollection> {
  const uaVisits = visits.filter((v) => v.countryCode === "UA");
  if (uaVisits.length === 0) return emptyCollection();

  const oblasts = await getCachedDataset("dataset:ua-oblasts", "dataset", () =>
    fetchGeoJson(UA_OBLASTS_URL)
  );

  return matchRegionsForVisits(
    uaVisits,
    oblasts,
    () => true,
    (f) => (f.properties?.region as string) ?? "Область"
  );
}

async function getForeignRegionBoundaries(visits: Visit[]): Promise<FeatureCollection> {
  const foreignVisits = visits.filter((v) => v.countryCode !== "UA");
  if (foreignVisits.length === 0) return emptyCollection();

  const admin1 = await getCachedDataset("dataset:admin1-states", "dataset", () =>
    fetchGeoJson(ADMIN1_STATES_URL)
  );

  return matchRegionsForVisits(
    foreignVisits,
    admin1,
    (visit, feature) => {
      const iso = feature.properties?.iso_a2 as string | undefined;
      return iso === visit.countryCode;
    },
    (f) => (f.properties?.name as string) ?? "Регіон"
  );
}

export async function getRegionBoundaries(visits: Visit[]): Promise<FeatureCollection> {
  if (visits.length === 0) return emptyCollection();

  const hash = visitsHash(visits);

  return getCachedMatchedRegions(`matched-regions:${hash}`, async () => {
    const [ukraine, foreign] = await Promise.all([
      getUkraineOblastBoundaries(visits),
      getForeignRegionBoundaries(visits),
    ]);

    return {
      type: "FeatureCollection",
      features: [...ukraine.features, ...foreign.features],
    };
  });
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
