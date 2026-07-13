import { NextResponse } from "next/server";
import { getAppSettings, setTravelStatus, type TravelStatus } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getAppSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("settings GET:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { travelStatus?: TravelStatus };
    if (body.travelStatus !== "home" && body.travelStatus !== "away") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const settings = await setTravelStatus(body.travelStatus);
    return NextResponse.json(settings);
  } catch (error) {
    console.error("settings PATCH:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
