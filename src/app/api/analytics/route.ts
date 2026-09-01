import { NextResponse } from "next/server";
import { computeAnalytics } from "@/lib/analytics";
import { getDatabase } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const db = await getDatabase();
  const analytics = computeAnalytics(db);
  return NextResponse.json({ analytics, players: db.players, games: db.games });
}
