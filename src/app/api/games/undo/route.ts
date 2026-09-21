import { NextResponse } from "next/server";
import {
  getUndoSessionPreview,
  undoRecentGames,
} from "@/lib/store";
import {
  evaluateWriteAccess,
  writeDeniedResponse,
  WRITE_DENIED_MESSAGE,
} from "@/lib/write-access";

export const runtime = "nodejs";

/** Preview the current undoable session (office write gate). */
export async function GET(request: Request) {
  const access = evaluateWriteAccess(request);
  if (!access.allowed) {
    return writeDeniedResponse(WRITE_DENIED_MESSAGE);
  }

  const session = await getUndoSessionPreview();
  return NextResponse.json({ session });
}

/**
 * Undo the newest N games of the current session.
 * Body: { gameIds: string[] } newest-first, must match the live session prefix.
 */
export async function POST(request: Request) {
  const access = evaluateWriteAccess(request);
  if (!access.allowed) {
    return writeDeniedResponse(WRITE_DENIED_MESSAGE);
  }

  try {
    const body = await request.json();
    const gameIds = Array.isArray(body.gameIds)
      ? body.gameIds.map(String)
      : [];
    const result = await undoRecentGames(gameIds);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to undo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
