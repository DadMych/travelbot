import { eq } from "drizzle-orm";
import type { FeatureCollection } from "geojson";
import { getDb, schema } from "@/lib/db";

const DATASET_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function getCachedDataset(
  cacheKey: string,
  kind: string,
  loader: () => Promise<FeatureCollection>
): Promise<FeatureCollection> {
  const db = getDb();

  const [cached] = await db
    .select()
    .from(schema.boundaryCache)
    .where(eq(schema.boundaryCache.cacheKey, cacheKey))
    .limit(1);

  if (
    cached &&
    Date.now() - new Date(cached.updatedAt).getTime() < DATASET_TTL_MS
  ) {
    return cached.payload;
  }

  const payload = await loader();

  await db
    .insert(schema.boundaryCache)
    .values({
      cacheKey,
      kind,
      label: cacheKey,
      payload,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.boundaryCache.cacheKey,
      set: {
        payload,
        updatedAt: new Date(),
      },
    });

  return payload;
}

export async function getCachedMatchedRegions(
  cacheKey: string,
  loader: () => Promise<FeatureCollection>
): Promise<FeatureCollection> {
  return getCachedDataset(cacheKey, "matched-regions", loader);
}
