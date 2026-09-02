import { NextResponse } from "next/server";
import { listPlayers, createPlayer } from "@/lib/store";
import {
  evaluateWriteAccess,
  writeDeniedResponse,
  WRITE_DENIED_MESSAGE_JOIN,
} from "@/lib/write-access";

export const runtime = "nodejs";

export async function GET() {
  const players = await listPlayers();
  return NextResponse.json({ players });
}

export async function POST(request: Request) {
  const access = evaluateWriteAccess(request);
  if (!access.allowed) {
    return writeDeniedResponse(WRITE_DENIED_MESSAGE_JOIN);
  }

  try {
    const body = await request.json();
    const player = await createPlayer({
      realName: String(body.realName ?? ""),
      nickname: String(body.nickname ?? ""),
    });
    return NextResponse.json({ player }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add player.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
