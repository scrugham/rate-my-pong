import { NextResponse } from "next/server";
import { listGames, createGame } from "@/lib/store";
import {
  evaluateWriteAccess,
  writeDeniedResponse,
  WRITE_DENIED_MESSAGE,
} from "@/lib/write-access";
import type { MatchFormat, ScoreMode } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const games = await listGames();
  return NextResponse.json({ games });
}

export async function POST(request: Request) {
  const access = evaluateWriteAccess(request);
  if (!access.allowed) {
    return writeDeniedResponse(WRITE_DENIED_MESSAGE);
  }

  try {
    const body = await request.json();
    const format = body.format as MatchFormat;
    if (format !== "singles" && format !== "doubles") {
      return NextResponse.json(
        { error: "Format must be singles or doubles." },
        { status: 400 }
      );
    }

    const scoreMode = (body.scoreMode as ScoreMode) || "exact";
    if (scoreMode !== "exact" && scoreMode !== "deuce") {
      return NextResponse.json(
        { error: "Score mode must be exact or deuce." },
        { status: 400 }
      );
    }

    const game = await createGame({
      format,
      sideA: Array.isArray(body.sideA) ? body.sideA.map(String) : [],
      sideB: Array.isArray(body.sideB) ? body.sideB.map(String) : [],
      scoreMode,
      scoreA: body.scoreA !== undefined ? Number(body.scoreA) : undefined,
      scoreB: body.scoreB !== undefined ? Number(body.scoreB) : undefined,
      winner:
        body.winner === "A" || body.winner === "B" ? body.winner : undefined,
    });
    return NextResponse.json({ game }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to log game.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
