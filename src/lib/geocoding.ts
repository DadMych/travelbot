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
  address?: NominatimAddress;
  geojson?: Geometry;
}

const NOMINATIM_HEADERS = {
  "User-Agent": "TravelMapBot/1.0 (personal travel tracker)",
};

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
  };
}

export async function searchPlaces(
  query: string,
  limit = 6,
  options?: { featureType?: "city" | "town" | "settlement" }
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

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: NOMINATIM_HEADERS,
      next: { revalidate: 3600 },
    }
  );

  if (!response.ok) {
    throw new Error("Geocoding failed");
  }

  const data = (await response.json()) as NominatimItem[];

  const placeTypes = new Set(["city", "town", "village", "municipality", "hamlet", "suburb"]);
  const placeItems = data.filter(
    (item) =>
      (item.class === "place" && placeTypes.has(item.type)) ||
      (item.class === "boundary" && item.type === "administrative")
  );

  const pool = placeItems.length > 0 ? placeItems : data.filter((item) => item.class !== "waterway");

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

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`,
    {
      headers: NOMINATIM_HEADERS,
    }
  );

  if (!response.ok) return null;

  const item = (await response.json()) as NominatimItem;
  return toResult(item);
}

export async function fetchPlaceBoundary(placeId: string): Promise<Geometry | null> {
  const params = new URLSearchParams({
    place_id: placeId,
    format: "json",
    polygon_geojson: "1",
    polygon_threshold: "0.002",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
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
