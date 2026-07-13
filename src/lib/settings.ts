import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export type TravelStatus = "home" | "away";

const SETTINGS_ID = "default";

export interface AppSettings {
  travelStatus: TravelStatus;
  updatedAt: Date;
}

export async function getAppSettings(): Promise<AppSettings> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.id, SETTINGS_ID))
    .limit(1);

  if (!row) {
    return { travelStatus: "home", updatedAt: new Date() };
  }

  return {
    travelStatus: row.travelStatus as TravelStatus,
    updatedAt: row.updatedAt,
  };
}

export async function setTravelStatus(status: TravelStatus): Promise<AppSettings> {
  const db = getDb();
  const now = new Date();

  await db
    .insert(schema.appSettings)
    .values({
      id: SETTINGS_ID,
      travelStatus: status,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.appSettings.id,
      set: {
        travelStatus: status,
        updatedAt: now,
      },
    });

  return { travelStatus: status, updatedAt: now };
}

export function travelStatusLabel(status: TravelStatus): string {
  return status === "away" ? "В подорожі" : "Вдома";
}

export function travelStatusEmoji(status: TravelStatus): string {
  return status === "away" ? "✈️" : "🏠";
}
