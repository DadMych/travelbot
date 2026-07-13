import { resolve } from "path";
import { config } from "dotenv";
import { backfillVisitBoundaries, getAllVisits } from "../src/lib/visits";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const before = await getAllVisits();
  const missing = before.filter((v) => !v.boundary).length;
  console.log(`\nМеж без полігону: ${missing} / ${before.length}\n`);

  let total = 0;
  while (true) {
    const updated = await backfillVisitBoundaries(5);
    total += updated;
    if (updated === 0) break;
    console.log(`+${updated} (всього ${total})`);
  }

  const after = await getAllVisits();
  const stillMissing = after.filter((v) => !v.boundary);
  console.log(`\nГотово. З межами: ${after.length - stillMissing.length}/${after.length}`);
  if (stillMissing.length) {
    console.log("Без меж (OSM не віддав полігон):");
    stillMissing.forEach((v) => console.log(`  - ${v.city}, ${v.country}`));
  }
}

main().catch(console.error);
