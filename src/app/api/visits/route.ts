import { NextResponse } from "next/server";
import { getAllVisits } from "@/lib/visits";
import { computeAchievements, computeStats } from "@/lib/achievements";
import { computeQuests, buildTimeline } from "@/lib/quests";
import { getAppSettings, type AppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const visits = await getAllVisits();
    const stats = computeStats(visits);
    const achievements = computeAchievements(visits);

    let settings: AppSettings = { travelStatus: "home", updatedAt: new Date() };
    try {
      settings = await getAppSettings();
    } catch (settingsError) {
      console.error("Failed to load settings:", settingsError);
    }

    return NextResponse.json({
      visits,
      stats,
      achievements,
      quests: computeQuests(visits),
      timeline: buildTimeline(visits),
      settings,
    });
  } catch (error) {
    console.error("Failed to fetch visits:", error);
    return NextResponse.json(
      { error: "Database not configured or unavailable" },
      { status: 503 }
    );
  }
}
