import { NextResponse } from "next/server";
import type { FeatureCollection } from "geojson";
import { getAllVisits } from "@/lib/visits";
import { computeAchievements, computeStats } from "@/lib/achievements";
import { getAdminBoundaries } from "@/lib/admin-boundaries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

export async function GET() {
  try {
    const visits = await getAllVisits();
    const stats = computeStats(visits);
    const achievements = computeAchievements(visits);

    let adminBoundaries = {
      countries: EMPTY_FC,
      regions: EMPTY_FC,
    };

    try {
      adminBoundaries = await getAdminBoundaries(visits);
    } catch (boundaryError) {
      console.error("Failed to load admin boundaries:", boundaryError);
    }

    return NextResponse.json({ visits, stats, achievements, adminBoundaries });
  } catch (error) {
    console.error("Failed to fetch visits:", error);
    return NextResponse.json(
      { error: "Database not configured or unavailable" },
      { status: 503 }
    );
  }
}
