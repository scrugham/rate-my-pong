import { NextResponse } from "next/server";
import { evaluateWriteAccess } from "@/lib/write-access";

export const runtime = "nodejs";

/** Read-only check so the Log / Join UI can disable submit before posting. */
export async function GET(request: Request) {
  const result = evaluateWriteAccess(request);
  return NextResponse.json({
    allowed: result.allowed,
    reason: result.reason,
  });
}
