import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { fetchPlaceBoundary, searchPlaces, type GeocodeResult } from "@/lib/geocoding";
import { sleep } from "@/lib/geojson";
import type { NewVisit, Visit } from "@/lib/db/schema";
import type { Geometry } from "geojson";

export async function getAllVisits(): Promise<Visit[]> {
  const db = getDb();
  return db
    .select()
    .from(schema.visits)
    .orderBy(desc(schema.visits.visitedAt));
}

export async function getVisitById(id: string): Promise<Visit | undefined> {
  const db = getDb();
  const [visit] = await db
    .select()
    .from(schema.visits)
    .where(eq(schema.visits.id, id))
    .limit(1);
  return visit;
}

async function resolveBoundary(place: GeocodeResult): Promise<Geometry | null> {
  if (place.boundary) return place.boundary;
  return fetchPlaceBoundary(place.id);
}

async function saveVisitBoundary(
  visitId: string,
  boundary: Geometry | null,
  osmPlaceId: string
): Promise<Visit | undefined> {
  const db = getDb();
  const [visit] = await db
    .update(schema.visits)
    .set({ boundary, osmPlaceId })
    .where(eq(schema.visits.id, visitId))
    .returning();
  return visit;
}

export async function enrichVisitBoundary(
  visit: Visit,
  placeId?: string
): Promise<Visit | null> {
  if (visit.boundary) return visit;

  let osmPlaceId = placeId ?? visit.osmPlaceId ?? undefined;

  if (!osmPlaceId) {
    const results = await searchPlaces(`${visit.city}, ${visit.country}`, 1);
    osmPlaceId = results[0]?.id;
  }

  if (!osmPlaceId) return null;

  const boundary = await fetchPlaceBoundary(osmPlaceId);
  if (!boundary) return null;

  const updated = await saveVisitBoundary(visit.id, boundary, osmPlaceId);
  return updated ?? null;
}

export async function backfillVisitBoundaries(limit = 3): Promise<number> {
  const db = getDb();
  const pending = await db
    .select()
    .from(schema.visits)
    .where(isNull(schema.visits.boundary))
    .limit(limit);

  let updated = 0;

  for (const visit of pending) {
    const enriched = await enrichVisitBoundary(visit);
    if (enriched) updated += 1;
    await sleep(1100);
  }

  return updated;
}

export async function createVisitFromGeocode(
  place: GeocodeResult,
  options?: { notes?: string; rating?: number; visitedAt?: Date; source?: string }
): Promise<{ visit: Visit; isNew: boolean }> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.visits)
    .where(
      and(
        eq(schema.visits.city, place.city),
        eq(schema.visits.countryCode, place.countryCode)
      )
    )
    .limit(1);

  if (existing) {
    if (!existing.boundary) {
      const enriched = await enrichVisitBoundary(existing, place.id);
      return { visit: enriched ?? existing, isNew: false };
    }
    return { visit: existing, isNew: false };
  }

  const boundary = await resolveBoundary(place);

  const data: NewVisit = {
    name: place.name,
    city: place.city,
    country: place.country,
    countryCode: place.countryCode,
    region: place.region,
    continent: place.continent,
    latitude: place.latitude,
    longitude: place.longitude,
    osmPlaceId: place.id,
    boundary,
    notes: options?.notes,
    rating: options?.rating,
    visitedAt: options?.visitedAt ?? new Date(),
    source: options?.source ?? "telegram",
  };

  const [visit] = await db.insert(schema.visits).values(data).returning();
  return { visit, isNew: true };
}

export async function deleteVisit(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(schema.visits)
    .where(eq(schema.visits.id, id))
    .returning({ id: schema.visits.id });
  return result.length > 0;
}

export async function updateVisit(
  id: string,
  data: Partial<Pick<Visit, "notes" | "rating" | "visitedAt">>
): Promise<Visit | undefined> {
  const db = getDb();
  const [visit] = await db
    .update(schema.visits)
    .set(data)
    .where(eq(schema.visits.id, id))
    .returning();
  return visit;
}
