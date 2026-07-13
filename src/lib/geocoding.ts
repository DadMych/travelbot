import type { Geometry } from "geojson";

export interface GeocodeResult {
  id: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  region: string | null;
  continent: string | null;
  latitude: number;
  longitude: number;
  displayName: string;
  type: string;
  osmType?: string;
  osmId?: number;
  boundary?: Geometry | null;
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  region?: string;
  country?: string;
  country_code?: string;
  county?: string;
}

interface NominatimItem {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  type: string;
  class: string;
  importance: number;
  osm_type?: string;
  osm_id?: number;
  address?: NominatimAddress;
  geojson?: Geometry;
}

interface NominatimDetails {
  osm_type?: string;
  osm_id?: number;
}

const NOMINATIM_HEADERS = {
  "User-Agent": "TravelMapBot/1.0 (personal travel tracker)",
};

const NOMINATIM_DELAY_MS = 1100;
let lastNominatimCall = 0;

async function nominatimFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const wait = NOMINATIM_DELAY_MS - (now - lastNominatimCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();
  return fetch(url, init);
}

const CONTINENT_BY_COUNTRY: Record<string, string> = {
  RU: "Europe",
  US: "North America",
  CA: "North America",
  MX: "North America",
  BR: "South America",
  AR: "South America",
  CL: "South America",
  CO: "South America",
  PE: "South America",
  GB: "Europe",
  FR: "Europe",
  DE: "Europe",
  IT: "Europe",
  ES: "Europe",
  PT: "Europe",
  NL: "Europe",
  BE: "Europe",
  CH: "Europe",
  AT: "Europe",
  PL: "Europe",
  CZ: "Europe",
  GR: "Europe",
  SE: "Europe",
  NO: "Europe",
  FI: "Europe",
  DK: "Europe",
  IE: "Europe",
  UA: "Europe",
  TR: "Asia",
  JP: "Asia",
  CN: "Asia",
  KR: "Asia",
  IN: "Asia",
  TH: "Asia",
  VN: "Asia",
  ID: "Asia",
  MY: "Asia",
  SG: "Asia",
  AE: "Asia",
  IL: "Asia",
  AU: "Oceania",
  NZ: "Oceania",
  EG: "Africa",
  ZA: "Africa",
  MA: "Africa",
  KE: "Africa",
  NG: "Africa",
};

function normalizeOsmType(type: string): string {
  const lower = type.toLowerCase();
  if (lower === "relation" || lower === "r") return "R";
  if (lower === "way" || lower === "w") return "W";
  if (lower === "node" || lower === "n") return "N";
  return type.charAt(0).toUpperCase();
}

export function toOsmRef(type: string, id: number | string): string {
  return `${normalizeOsmType(type)}${id}`;
}

function extractCity(item: NominatimItem): string {
  const address = item.address;
  const fromAddress =
    address?.city ??
    address?.town ??
    address?.village ??
    address?.municipality ??
    address?.county;

  if (fromAddress) return fromAddress;
  if (item.name) return item.name;

  const firstPart = item.display_name.split(",")[0]?.trim();
  return firstPart || "Unknown";
}

function extractRegion(address?: NominatimAddress): string | null {
  if (!address) return null;
  return address.state ?? address.region ?? null;
}

function toResult(item: NominatimItem): GeocodeResult {
  const city = extractCity(item);
  const country = item.address?.country ?? "Unknown";
  const countryCode = (item.address?.country_code ?? "xx").toUpperCase();
  const region = extractRegion(item.address);
  const continent = CONTINENT_BY_COUNTRY[countryCode] ?? null;

  const subtitle = [region, country].filter(Boolean).join(", ");
  const displayName = subtitle ? `${city} · ${subtitle}` : city;

  return {
    id: String(item.place_id),
    name: city,
    city,
    country,
    countryCode,
    region,
    continent,
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
    displayName,
    type: item.type,
    osmType: item.osm_type ? normalizeOsmType(item.osm_type) : undefined,
    osmId: item.osm_id,
  };
}

export async function searchPlaces(
  query: string,
  limit = 6,
  options?: { featureType?: "city" | "town" | "settlement"; _retry?: number }
): Promise<GeocodeResult[]> {
  const fetchLimit = Math.max(limit * 4, 10);
  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: String(fetchLimit),
    "accept-language": "uk,en",
  });

  if (options?.featureType) {
    params.set("featuretype", options.featureType);
  }

  const response = await nominatimFetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: NOMINATIM_HEADERS,
      next: { revalidate: 3600 },
    }
  );

  if (!response.ok) {
    const retry = options?._retry ?? 0;
    if (response.status === 429 && retry < 2) {
      await new Promise((r) => setTimeout(r, 3000 * (retry + 1)));
      return searchPlaces(query, limit, { ...options, _retry: retry + 1 });
    }
    throw new Error("Geocoding failed");
  }

  const data = (await response.json()) as NominatimItem[];

  const placeTypes = new Set(["city", "town", "village", "municipality", "hamlet", "suburb"]);
  const placeItems = data.filter(
    (item) =>
      (item.class === "place" && placeTypes.has(item.type)) ||
      (item.class === "boundary" && item.type === "administrative")
  );

  const sorted = [...placeItems].sort((a, b) => {
    const rank = (item: NominatimItem) => {
      const t = item.osm_type?.toLowerCase();
      if (t === "relation" || t === "r") return 0;
      if (t === "way" || t === "w") return 1;
      return 2;
    };
    return rank(a) - rank(b);
  });

  const pool = sorted.length > 0 ? sorted : data.filter((item) => item.class !== "waterway");

  const seen = new Set<string>();
  const results: GeocodeResult[] = [];

  for (const item of pool) {
    if (item.class !== "place" && item.class !== "boundary") continue;
    const result = toResult(item);
    const key = `${result.city}|${result.countryCode}|${Math.round(result.latitude * 100)}|${Math.round(result.longitude * 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(result);
    if (results.length >= limit) break;
  }

  return results.sort((a, b) => {
    const typeOrder = (type: string) => {
      if (type === "city") return 0;
      if (type === "town") return 1;
      if (type === "village") return 2;
      return 3;
    };
    return typeOrder(a.type) - typeOrder(b.type);
  });
}

async function searchPlacesBroad(
  query: string,
  limit = 5
): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: String(Math.max(limit * 3, 10)),
    "accept-language": "uk,en",
  });

  const response = await nominatimFetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: NOMINATIM_HEADERS }
  );

  if (!response.ok) return [];

  const data = (await response.json()) as NominatimItem[];
  const skipClasses = new Set(["waterway", "natural", "landuse", "highway"]);

  const results: GeocodeResult[] = [];
  const seen = new Set<string>();

  for (const item of data) {
    if (skipClasses.has(item.class)) continue;
    if (item.class === "place" || item.class === "boundary" || item.class === "amenity") {
      const result = toResult(item);
      const key = `${result.city}|${result.countryCode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(result);
      if (results.length >= limit) break;
    }
  }

  return results;
}

export async function searchPlacesRobust(
  query: string,
  limit = 5
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const variants = [trimmed, trimmed.replace(/\s+/g, " ")];

  for (const variant of variants) {
    const results = await searchPlaces(variant, limit);
    if (results.length > 0) return results;
  }

  for (const variant of variants) {
    const results = await searchPlacesBroad(variant, limit);
    if (results.length > 0) return results;
  }

  return [];
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "json",
    addressdetails: "1",
    "accept-language": "uk,en",
  });

  const response = await nominatimFetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`,
    {
      headers: NOMINATIM_HEADERS,
    }
  );

  if (!response.ok) return null;

  const item = (await response.json()) as NominatimItem;
  return toResult(item);
}

async function resolveOsmIds(
  placeId: string,
  osmType?: string,
  osmId?: number
): Promise<string | null> {
  if (osmType && osmId) {
    return toOsmRef(osmType, osmId);
  }

  const response = await nominatimFetch(
    `https://nominatim.openstreetmap.org/details?place_id=${placeId}&format=json`,
    { headers: NOMINATIM_HEADERS }
  );

  if (!response.ok) return null;

  const details = (await response.json()) as NominatimDetails;
  if (!details.osm_type || !details.osm_id) return null;

  return toOsmRef(details.osm_type, details.osm_id);
}

export async function fetchPlaceBoundariesBatch(
  osmRefs: string[]
): Promise<Map<string, Geometry>> {
  const results = new Map<string, Geometry>();
  const unique = [...new Set(osmRefs.filter(Boolean))];

  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const params = new URLSearchParams({
      osm_ids: chunk.join(","),
      format: "json",
      polygon_geojson: "1",
      polygon_threshold: "0.002",
    });

    const response = await nominatimFetch(
      `https://nominatim.openstreetmap.org/lookup?${params}`,
      { headers: NOMINATIM_HEADERS }
    );

    if (!response.ok) continue;

    const data = (await response.json()) as NominatimItem[];
    for (const item of data) {
      if (!item.geojson || !item.osm_type || !item.osm_id) continue;
      if (!["Polygon", "MultiPolygon"].includes(item.geojson.type)) continue;
      results.set(toOsmRef(item.osm_type, item.osm_id), item.geojson);
    }
  }

  return results;
}

export async function resolveOsmRef(
  placeId: string,
  osmType?: string,
  osmId?: number
): Promise<string | null> {
  return resolveOsmIds(placeId, osmType, osmId);
}

export async function fetchPlaceBoundary(
  placeId: string,
  osmType?: string,
  osmId?: number
): Promise<Geometry | null> {
  const osmIds = await resolveOsmIds(placeId, osmType, osmId);
  if (!osmIds) return null;

  const params = new URLSearchParams({
    osm_ids: osmIds,
    format: "json",
    polygon_geojson: "1",
    polygon_threshold: "0.002",
  });

  const response = await nominatimFetch(
    `https://nominatim.openstreetmap.org/lookup?${params}`,
    { headers: NOMINATIM_HEADERS }
  );

  if (!response.ok) return null;

  const data = (await response.json()) as NominatimItem[];
  const item = data[0];
  if (!item?.geojson) return null;

  const validTypes = ["Polygon", "MultiPolygon"];
  if (!validTypes.includes(item.geojson.type)) return null;

  return item.geojson;
}

export async function fetchBoundaryForPlace(
  place: Pick<GeocodeResult, "id" | "osmType" | "osmId">
): Promise<Geometry | null> {
  return fetchPlaceBoundary(place.id, place.osmType, place.osmId);
}

export async function findPlaceBoundary(
  city: string,
  country: string
): Promise<{ boundary: Geometry; osmPlaceId: string } | null> {
  const places = await searchPlaces(`${city}, ${country}`, 3);

  for (const place of places) {
    const boundary = await fetchBoundaryForPlace(place);
    if (boundary) {
      return { boundary, osmPlaceId: place.id };
    }
  }

  return null;
}

export async function searchAdministrativeBoundary(
  query: string,
  countryCode?: string
): Promise<{ osmRef: string; geometry: Geometry | null; name: string } | null> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "8",
    polygon_geojson: "1",
    polygon_threshold: "0.005",
    "accept-language": "uk,en",
  });

  if (countryCode) {
    params.set("countrycodes", countryCode.toLowerCase());
  }

  const response = await nominatimFetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: NOMINATIM_HEADERS }
  );

  if (!response.ok) return null;

  const data = (await response.json()) as NominatimItem[];

  const isRelation = (item: NominatimItem) => {
    const t = item.osm_type?.toLowerCase();
    return t === "relation" || t === "r";
  };

  const adminItems = data.filter(
    (item) => item.class === "boundary" && item.type === "administrative"
  );

  const best =
    adminItems.find(isRelation) ??
    adminItems[0] ??
    data.find((item) => item.class === "boundary");

  if (!best?.osm_type || !best.osm_id) return null;

  const geometry =
    best.geojson && ["Polygon", "MultiPolygon"].includes(best.geojson.type)
      ? best.geojson
      : null;

  return {
    osmRef: toOsmRef(best.osm_type, best.osm_id),
    geometry,
    name: best.display_name.split(",")[0]?.trim() ?? query,
  };
}
