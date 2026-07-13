import type { Geometry } from "geojson";

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

export function pointInGeometry(lng: number, lat: number, geometry: Geometry): boolean {
  switch (geometry.type) {
    case "Polygon":
      return pointInPolygonRings(lng, lat, geometry.coordinates);
    case "MultiPolygon":
      return geometry.coordinates.some((polygon) =>
        pointInPolygonRings(lng, lat, polygon)
      );
    default:
      return false;
  }
}

function pointInPolygonRings(lng: number, lat: number, rings: number[][][]): boolean {
  if (rings.length === 0) return false;
  if (!pointInRing(lng, lat, rings[0])) return false;

  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false;
  }

  return true;
}
