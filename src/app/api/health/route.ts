import { NextResponse } from "next/server";

// Unauthenticated liveness check. Used by the restore flow to detect when the
// container has finished restarting after a backup was restored.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
