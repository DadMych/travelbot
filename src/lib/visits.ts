import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { GeocodeResult } from "@/lib/geocoding";
import type { NewVisit, Visit } from "@/lib/db/schema";

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

export async function createVisitFromGeocode(
  place: GeocodeResult,
  options?: { notes?: string; rating?: number; visitedAt?: Date; source?: string }
): Promise<Visit> {
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
    return existing;
  }

  const data: NewVisit = {
    name: place.name,
    city: place.city,
    country: place.country,
    countryCode: place.countryCode,
    region: place.region,
    continent: place.continent,
    latitude: place.latitude,
    longitude: place.longitude,
    notes: options?.notes,
    rating: options?.rating,
    visitedAt: options?.visitedAt ?? new Date(),
    source: options?.source ?? "telegram",
  };

  const [visit] = await db.insert(schema.visits).values(data).returning();
  return visit;
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
