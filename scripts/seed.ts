import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";
import { searchPlaces, fetchPlaceBoundary } from "../src/lib/geocoding";
import { getDb, schema } from "../src/lib/db";
import { and, eq } from "drizzle-orm";
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

async function seedEntry(entry: SeedEntry, index: number, total: number) {
  const label = `[${index + 1}/${total}] ${entry.query}`;
  process.stdout.write(`${label} ... `);

  const places = await searchPlaces(entry.query.trim(), 3);
  if (places.length === 0) {
    console.log("не знайдено");
    return "not_found";
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
    console.log(`пропуск (вже є: ${existing.city}, ${existing.country})`);
    return "skipped";
  }

  const boundary = await fetchPlaceBoundary(place.id);
  await sleep(1100);

  const visitedAt =
    entry.year !== undefined ? yearToDate(entry.year) : null;

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
    visitedAt,
    notes: entry.notes,
    rating: entry.rating,
    source: "seed",
  });

  const dateLabel = entry.year ? String(entry.year) : "дата невідома";
  console.log(`ok → ${place.city}, ${place.country} (${dateLabel})`);
  return "added";
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задано. Створи .env.local");
    process.exit(1);
  }

  const filePath = resolve(process.cwd(), "data/cities.seed.json");
  const raw = readFileSync(filePath, "utf-8");
  const entries = JSON.parse(raw) as SeedEntry[];

  if (!Array.isArray(entries) || entries.length === 0) {
    console.error("cities.seed.json порожній або некоректний");
    process.exit(1);
  }

  console.log(`\n🗺  Seed: ${entries.length} міст\n`);

  const stats = { added: 0, skipped: 0, not_found: 0, failed: 0 };

  for (let i = 0; i < entries.length; i++) {
    try {
      const result = await seedEntry(entries[i], i, entries.length);
      stats[result as keyof typeof stats] += 1;
      if (i < entries.length - 1) await sleep(1100);
    } catch (err) {
      console.log("помилка");
      stats.failed += 1;
      console.error(err);
    }
  }

  console.log("\n---");
  console.log(`Додано: ${stats.added}`);
  console.log(`Пропущено (дублікати): ${stats.skipped}`);
  console.log(`Не знайдено: ${stats.not_found}`);
  if (stats.failed) console.log(`Помилки: ${stats.failed}`);
  console.log("\nВідкрий карту — межі підтягнуться автоматично.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
