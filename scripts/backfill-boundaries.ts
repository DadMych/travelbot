import { resolve } from "path";
import { config } from "dotenv";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "../src/lib/db";
import {
  fetchPlaceBoundariesBatch,
  resolveOsmRef,
  searchPlaces,
  toOsmRef,
} from "../src/lib/geocoding";
import { sleep } from "../src/lib/geojson";

config({ path: resolve(process.cwd(), ".env.local") });

type Visit = typeof schema.visits.$inferSelect;

async function resolveMissingOsmRefs(visits: Visit[]) {
  const db = getDb();
  let resolved = 0;

  for (const visit of visits) {
    if (visit.osmType && visit.osmId) continue;

    process.stdout.write(`ref ${visit.city} ... `);

    try {
      let osmType = visit.osmType ?? undefined;
      let osmId = visit.osmId ?? undefined;
      let osmPlaceId = visit.osmPlaceId ?? undefined;

      if (visit.osmPlaceId && !osmType) {
        const ref = await resolveOsmRef(visit.osmPlaceId);
        if (ref) {
          osmType = ref.charAt(0);
          osmId = ref.slice(1);
        }
      }

      if (!osmType || !osmId) {
        const places = await searchPlaces(`${visit.city}, ${visit.country}`, 3);
        const place =
          places.find((p) => p.osmType === "R") ??
          places.find((p) => p.osmType && p.osmId) ??
          places[0];
        if (place?.osmType && place.osmId) {
          osmType = place.osmType;
          osmId = String(place.osmId);
          osmPlaceId = place.id;
        }
      }

      if (osmType && osmId) {
        osmType = osmType.length === 1 ? osmType : toOsmRef(osmType, osmId).charAt(0);
        await db
          .update(schema.visits)
          .set({ osmType, osmId, osmPlaceId: osmPlaceId ?? visit.osmPlaceId })
          .where(eq(schema.visits.id, visit.id));
        resolved += 1;
        console.log(`✓ ${osmType}${osmId}`);
      } else {
        console.log("✗");
      }
    } catch {
      console.log("✗ rate limit");
    }
  }

  return resolved;
}

async function main() {
  const db = getDb();

  let pending = await db
    .select()
    .from(schema.visits)
    .where(isNull(schema.visits.boundary))
    .orderBy(desc(schema.visits.createdAt));

  console.log(`\n🗺  Batch backfill: ${pending.length} міст без меж\n`);

  if (pending.length === 0) {
    console.log("Все вже з межами.\n");
    return;
  }

  const needRefs = pending.filter((v) => !v.osmType || !v.osmId);
  if (needRefs.length > 0) {
    console.log(`--- Крок 1: OSM refs для ${needRefs.length} міст (1 req/sec) ---\n`);
    await resolveMissingOsmRefs(needRefs);
    pending = await db
      .select()
      .from(schema.visits)
      .where(isNull(schema.visits.boundary));
  } else {
    console.log("--- Крок 1: OSM refs вже є, пропуск ---\n");
  }

  // Fix bad osmType values from earlier runs (e.g. "relation" instead of "R")
  for (const visit of pending) {
    if (visit.osmType && visit.osmId && visit.osmType.length > 1) {
      const fixed = toOsmRef(visit.osmType, visit.osmId);
      await db
        .update(schema.visits)
        .set({ osmType: fixed.charAt(0), osmId: fixed.slice(1) })
        .where(eq(schema.visits.id, visit.id));
      visit.osmType = fixed.charAt(0);
      visit.osmId = fixed.slice(1);
    }
  }

  const withRefs = pending.filter((v) => v.osmType && v.osmId);
  console.log(`\n--- Крок 2: batch lookup (до 50 міст за 1 запит) ---`);
  console.log(`Можна batch: ${withRefs.length} / ${pending.length}\n`);

  if (withRefs.length === 0) {
    console.log("Немає OSM refs для batch.\n");
    return;
  }

  const osmRefs = withRefs.map((v) => toOsmRef(v.osmType!, v.osmId!));
  const boundaries = await fetchPlaceBoundariesBatch(osmRefs);

  let saved = 0;
  for (const visit of withRefs) {
    const key = toOsmRef(visit.osmType!, visit.osmId!);
    const boundary = boundaries.get(key);
    if (!boundary) {
      console.log(`✗ ${visit.city} — полігону немає в OSM`);
      continue;
    }
    await db
      .update(schema.visits)
      .set({ boundary })
      .where(eq(schema.visits.id, visit.id));
    saved += 1;
    console.log(`✓ ${visit.city}`);
  }

  const left = await db
    .select()
    .from(schema.visits)
    .where(isNull(schema.visits.boundary));

  if (left.length > 0) {
    console.log(`\n--- Крок 3: relation-only для ${left.length} міст ---\n`);
    const retryRefs: string[] = [];
    const retryVisits: Visit[] = [];

    for (const visit of left) {
      process.stdout.write(`${visit.city} ... `);
      try {
        const places = await searchPlaces(`${visit.city}, ${visit.country}`, 5);
        const relation = places.find((p) => p.osmType === "R");
        if (!relation?.osmId) {
          console.log("✗");
          continue;
        }
        const osmType = "R";
        const osmId = String(relation.osmId);
        await db
          .update(schema.visits)
          .set({ osmType, osmId, osmPlaceId: relation.id })
          .where(eq(schema.visits.id, visit.id));
        retryRefs.push(toOsmRef(osmType, osmId));
        retryVisits.push({ ...visit, osmType, osmId });
        console.log(`✓ R${osmId}`);
      } catch {
        console.log("✗");
      }
    }

    if (retryRefs.length > 0) {
      const retryBoundaries = await fetchPlaceBoundariesBatch(retryRefs);
      for (const visit of retryVisits) {
        const boundary = retryBoundaries.get(toOsmRef(visit.osmType!, visit.osmId!));
        if (boundary) {
          await db
            .update(schema.visits)
            .set({ boundary })
            .where(eq(schema.visits.id, visit.id));
          saved += 1;
          console.log(`  → ${visit.city} залито`);
        }
      }
    }
  }

  const finalLeft = await db
    .select()
    .from(schema.visits)
    .where(isNull(schema.visits.boundary));

  console.log(`\nГотово: ${saved} меж залито. Залишилось без меж: ${finalLeft.length}`);
  if (finalLeft.length) {
    console.log("Без полігону в OSM:", finalLeft.map((v) => v.city).join(", "));
  }
  console.log();
}

main().catch(console.error);
