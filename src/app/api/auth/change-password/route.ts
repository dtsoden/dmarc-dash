import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import { getUserByLogin, setPassword } from "@/lib/auth/users";
import { verifyPassword } from "@/lib/auth/password";

export async function POST(req: Request) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions());
  if (!session.loggedIn || !session.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { currentPassword, newPassword } = await req.json();
  if (!newPassword || newPassword.length < 8) return NextResponse.json({ error: "Password too short" }, { status: 400 });
  const row = getUserByLogin(session.username!);
  // Session user may have been deleted while the session was still live.
  if (!row) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  // Skip current-password check only when a forced change is pending.
  if (!session.mustChangePassword && !verifyPassword(currentPassword ?? "", row.password_hash))
    return NextResponse.json({ error: "Current password incorrect" }, { status: 400 });
  setPassword(session.userId, newPassword);
  session.mustChangePassword = false; await session.save();
  return NextResponse.json({ ok: true });
}
