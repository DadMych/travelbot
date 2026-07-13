import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import {
  fetchPlaceBoundariesBatch,
  fetchPlaceBoundary,
  resolveOsmRef,
  searchPlaces,
  type GeocodeResult,
} from "@/lib/geocoding";
import { sleep } from "@/lib/geojson";
import type { NewVisit, Visit } from "@/lib/db/schema";
import type { Geometry } from "geojson";

export async function getAllVisits(): Promise<Visit[]> {
  const db = getDb();
  return db
    .select()
    .from(schema.visits)
    .orderBy(
      sql`${schema.visits.visitedAt} desc nulls last`,
      desc(schema.visits.createdAt)
    );
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

async function boundaryFromPlace(place: GeocodeResult): Promise<Geometry | null> {
  if (place.boundary) return place.boundary;
  if (place.osmType && place.osmId) {
    const batch = await fetchPlaceBoundariesBatch([`${place.osmType}${place.osmId}`]);
    return batch.get(`${place.osmType}${place.osmId}`) ?? null;
  }
  return fetchPlaceBoundary(place.id, place.osmType, place.osmId);
}

export async function backfillVisitBoundaries(limit = 50): Promise<number> {
  const db = getDb();
  const pending = await db
    .select()
    .from(schema.visits)
    .where(isNull(schema.visits.boundary))
    .limit(limit);

  if (pending.length === 0) return 0;

  for (const visit of pending) {
    if (visit.osmType && visit.osmId) continue;
    const places = await searchPlaces(`${visit.city}, ${visit.country}`, 1);
    const place = places[0];
    if (place?.osmType && place.osmId) {
      await db
        .update(schema.visits)
        .set({
          osmType: place.osmType,
          osmId: String(place.osmId),
          osmPlaceId: place.id,
        })
        .where(eq(schema.visits.id, visit.id));
      visit.osmType = place.osmType;
      visit.osmId = String(place.osmId);
    } else if (visit.osmPlaceId) {
      const ref = await resolveOsmRef(visit.osmPlaceId);
      if (ref) {
        await db
          .update(schema.visits)
          .set({ osmType: ref.charAt(0), osmId: ref.slice(1) })
          .where(eq(schema.visits.id, visit.id));
        visit.osmType = ref.charAt(0);
        visit.osmId = ref.slice(1);
      }
    }
    await sleep(1100);
  }

  const refs = pending
    .filter((v) => v.osmType && v.osmId)
    .map((v) => `${v.osmType}${v.osmId}`);

  if (refs.length === 0) return 0;

  const boundaries = await fetchPlaceBoundariesBatch(refs);
  let updated = 0;

  for (const visit of pending) {
    if (!visit.osmType || !visit.osmId) continue;
    const boundary = boundaries.get(`${visit.osmType}${visit.osmId}`);
    if (!boundary) continue;
    await db
      .update(schema.visits)
      .set({ boundary })
      .where(eq(schema.visits.id, visit.id));
    updated += 1;
  }

  return updated;
}

export async function createVisitFromGeocode(
  place: GeocodeResult,
  options?: {
    notes?: string;
    rating?: number;
    visitedAt?: Date | null;
    source?: string;
  }
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
    return { visit: existing, isNew: false };
  }

  const boundary = await boundaryFromPlace(place);

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
    osmType: place.osmType ?? null,
    osmId: place.osmId ? String(place.osmId) : null,
    boundary,
    notes: options?.notes,
    rating: options?.rating,
    visitedAt:
      options?.visitedAt !== undefined ? options.visitedAt : null,
    source: options?.source ?? "telegram",
  };

  const [visit] = await db.insert(schema.visits).values(data).returning();
  return { visit, isNew: true };
}

export async function addCityFromGeocodeVerified(
  place: GeocodeResult,
  options?: {
    notes?: string;
    rating?: number;
    visitedAt?: Date | null;
    source?: string;
  }
): Promise<{ visit: Visit; isNew: boolean }> {
  const result = await createVisitFromGeocode(place, options);

  const verified = await getVisitById(result.visit.id);
  if (!verified) {
    throw new Error(`Не вдалося підтвердити збереження «${place.city}»`);
  }

  if (
    Math.abs(verified.latitude - place.latitude) > 0.01 ||
    Math.abs(verified.longitude - place.longitude) > 0.01
  ) {
    throw new Error(`Координати «${place.city}» не збіглися після збереження`);
  }

  return { visit: verified, isNew: result.isNew };
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
