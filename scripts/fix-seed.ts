import { resolve } from "path";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../src/lib/db";
import { searchPlaces, fetchPlaceBoundary } from "../src/lib/geocoding";
import { sleep } from "../src/lib/geojson";

config({ path: resolve(process.cwd(), ".env.local") });

interface SeedEntry {
  query: string;
  year?: number;
  notes?: string;
  rating?: number;
}

function yearToDate(year: number): Date {
  return new Date(Date.UTC(year, 5, 15, 12, 0, 0));
}

async function addEntry(entry: SeedEntry) {
  const places = await searchPlaces(entry.query.trim(), 3);
  if (places.length === 0) {
    console.log(`✗ ${entry.query} — не знайдено`);
    return;
  }

  const place = places[0];
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
    console.log(`– ${entry.query} → вже є (${place.city})`);
    return;
  }

  const boundary = await fetchPlaceBoundary(place.id);
  await sleep(1100);

  await db.insert(schema.visits).values({
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
    visitedAt: entry.year !== undefined ? yearToDate(entry.year) : null,
    notes: entry.notes,
    rating: entry.rating,
    source: "seed",
  });

  console.log(`✓ ${entry.query} → ${place.city}, ${place.country}`);
}

async function main() {
  const db = getDb();

  const bad = await db
    .delete(schema.visits)
    .where(
      and(eq(schema.visits.city, "Unknown"), eq(schema.visits.countryCode, "PL"))
    )
    .returning();

  if (bad.length) {
    console.log(`Видалено помилковий запис: Unknown, Poland\n`);
  }

  const filePath = resolve(process.cwd(), "data/cities.fix.json");
  const entries = JSON.parse(readFileSync(filePath, "utf-8")) as SeedEntry[];

  console.log(`Додаю ${entries.length} міст...\n`);

  for (const entry of entries) {
    await addEntry(entry);
    await sleep(1100);
  }

  console.log("\nГотово.");
}

main().catch(console.error);
