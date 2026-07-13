import { NextResponse } from "next/server";
import { getAllVisits } from "@/lib/visits";
import { computeAchievements, computeStats } from "@/lib/achievements";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const visits = await getAllVisits();
    const stats = computeStats(visits);
    const achievements = computeAchievements(visits);

    return NextResponse.json({ visits, stats, achievements });
  } catch (error) {
    console.error("Failed to fetch visits:", error);
    return NextResponse.json(
      { error: "Database not configured or unavailable" },
      { status: 503 }
    );
  }
}
