import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import { runPollOnce } from "@/lib/scheduler";

// Manually trigger the same poll the scheduler runs. Admin or Analyst only.
export async function POST() {
  const s = await getSession();
  if (!s.loggedIn || (s.role !== "admin" && s.role !== "analyst")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await runPollOnce();
  return NextResponse.json({ ok: true, result });
}
