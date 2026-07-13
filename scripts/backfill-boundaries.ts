import { resolve } from "path";
import { config } from "dotenv";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "../src/lib/db";
import { findPlaceBoundary } from "../src/lib/geocoding";
import { sleep } from "../src/lib/geojson";

config({ path: resolve(process.cwd(), ".env.local") });

async function enrichVisit(visit: typeof schema.visits.$inferSelect) {
  if (visit.boundary) return true;

  const found = await findPlaceBoundary(visit.city, visit.country);
  if (!found) return false;

  const db = getDb();
  await db
    .update(schema.visits)
    .set({ boundary: found.boundary, osmPlaceId: found.osmPlaceId })
    .where(eq(schema.visits.id, visit.id));
  return true;
}

async function main() {
  const db = getDb();
  const all = await db
    .select()
    .from(schema.visits)
    .orderBy(sql`${schema.visits.visitedAt} desc nulls last`, desc(schema.visits.createdAt));

  const missing = all.filter((v) => !v.boundary);
  console.log(`\n🗺  Меж без полігону: ${missing.length} / ${all.length}\n`);

  let ok = 0;
  let fail = 0;

  for (const visit of missing) {
    process.stdout.write(`${visit.city} ... `);
    try {
      const success = await enrichVisit(visit);
      if (success) {
        ok += 1;
        console.log("✓");
      } else {
        fail += 1;
        console.log("✗");
      }
    } catch (err) {
      fail += 1;
      console.log("✗ (rate limit, спробуй пізніше)");
    }
    await sleep(500);
  }

  console.log(`\nГотово: ${ok} ok, ${fail} без полігону в OSM\n`);
}

main().catch(console.error);
