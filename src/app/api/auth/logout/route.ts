import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/auth/session";

export async function POST() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions());
  session.destroy();
  // With LANDING=1 a signed-out visit to "/" shows the public landing page (the proxy
  // rewrite sees no session cookie), so send people there after logout. Without it,
  // "/" would just bounce through the dashboard guard, so go straight to the login.
  const redirectTo = process.env.LANDING === "1" ? "/" : "/login";
  return NextResponse.json({ ok: true, redirectTo });
}
