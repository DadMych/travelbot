import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";
import { and, eq, isNotNull } from "drizzle-orm";
import { searchPlaces } from "../src/lib/geocoding";
import { getDb, schema } from "../src/lib/db";
import { sleep } from "../src/lib/geojson";

config({ path: resolve(process.cwd(), ".env.local") });

interface SeedEntry {
  query: string;
  year?: number;
}

function yearToDate(year: number): Date {
  return new Date(Date.UTC(year, 5, 15, 12, 0, 0));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задано");
    process.exit(1);
  }

  const raw = readFileSync(resolve(process.cwd(), "data/cities.seed.json"), "utf-8");
  const entries = JSON.parse(raw) as SeedEntry[];
  const db = getDb();

  let updated = 0;

  for (const entry of entries) {
    if (entry.year == null) continue;

    const places = await searchPlaces(entry.query.trim(), 1);
    const place = places[0];
    if (!place) {
      console.log(`skip (not found): ${entry.query}`);
      continue;
    }

    const targetDate = yearToDate(entry.year);

    const result = await db
      .update(schema.visits)
      .set({ visitedAt: targetDate })
      .where(
        and(
          eq(schema.visits.city, place.city),
          eq(schema.visits.countryCode, place.countryCode)
        )
      )
      .returning({ id: schema.visits.id, city: schema.visits.city });

    if (result.length > 0) {
      updated += result.length;
      console.log(`✓ ${place.city} → ${entry.year}`);
    }

    await sleep(1100);
  }

  const telegramRecent = await db
    .update(schema.visits)
    .set({ visitedAt: null })
    .where(and(eq(schema.visits.source, "telegram"), isNotNull(schema.visits.visitedAt)))
    .returning({ id: schema.visits.id });

  console.log(`\nОновлено з seed: ${updated}`);
  console.log(`Telegram без точної дати: ${telegramRecent.length}`);
}

main().catch(console.error);
