import type { BBox, FeatureCollection, Geometry } from "geojson";

export function visitsToFeatureCollection(
  visits: Array<{
    id: string;
    city: string;
    boundary: Geometry | null;
  }>,
  selectedId?: string
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: visits
      .filter((v) => v.boundary)
      .map((v) => ({
        type: "Feature" as const,
        id: v.id,
        properties: {
          visitId: v.id,
          city: v.city,
          selected: v.id === selectedId,
        },
        geometry: v.boundary!,
      })),
  };
}

export function geometryBBox(geometry: Geometry): BBox | null {
  const coords: number[][] = [];

  function collect(node: Geometry | null | undefined) {
    if (!node) return;
    switch (node.type) {
      case "Point":
        coords.push(node.coordinates as number[]);
        break;
      case "MultiPoint":
      case "LineString":
        coords.push(...(node.coordinates as number[][]));
        break;
      case "MultiLineString":
      case "Polygon":
        for (const ring of node.coordinates as number[][][]) {
          coords.push(...ring);
        }
        break;
      case "MultiPolygon":
        for (const poly of node.coordinates as number[][][][]) {
          for (const ring of poly) {
            coords.push(...ring);
          }
        }
        break;
      case "GeometryCollection":
        node.geometries.forEach(collect);
        break;
    }
  }

  collect(geometry);
  if (coords.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }

  return [minLng, minLat, maxLng, maxLat];
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
