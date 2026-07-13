import { NextResponse } from "next/server";
import { backfillVisitBoundaries } from "@/lib/visits";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const updated = await backfillVisitBoundaries(3);
    return NextResponse.json({ updated });
  } catch (error) {
    console.error("Boundary backfill failed:", error);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
