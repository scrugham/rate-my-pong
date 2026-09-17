import { NextResponse } from "next/server";
import { createFeedback, listFeedback } from "@/lib/store";
import {
  evaluateWriteAccess,
  writeDeniedResponse,
  WRITE_DENIED_MESSAGE,
} from "@/lib/write-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = evaluateWriteAccess(request);
  if (!access.allowed) {
    return writeDeniedResponse(WRITE_DENIED_MESSAGE);
  }

  const feedback = await listFeedback();
  return NextResponse.json({ feedback });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const item = await createFeedback({
      message: typeof body.message === "string" ? body.message : "",
      name: typeof body.name === "string" ? body.name : null,
    });
    return NextResponse.json({ feedback: item }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to submit feedback.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
