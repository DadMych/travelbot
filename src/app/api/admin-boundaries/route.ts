import { NextResponse } from "next/server";
import { getAdminBoundaries } from "@/lib/admin-boundaries";
import { getAllVisits } from "@/lib/visits";

export const maxDuration = 60;

export async function GET() {
  try {
    const visits = await getAllVisits();
    const boundaries = await getAdminBoundaries(visits);
    return NextResponse.json(boundaries);
  } catch (error) {
    console.error("admin-boundaries error:", error);
    return NextResponse.json(
      {
        countries: { type: "FeatureCollection", features: [] },
        regions: { type: "FeatureCollection", features: [] },
      },
      { status: 500 }
    );
  }
}
