import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import { verifyLogin } from "@/lib/auth/users";

export async function POST(req: Request) {
  const { login, password } = await req.json();
  const user = verifyLogin(login ?? "", password ?? "");
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions());
  session.userId = user.id; session.username = user.username; session.role = user.role;
  session.loggedIn = true; session.mustChangePassword = user.mustChangePassword;
  await session.save();
  return NextResponse.json({ ok: true, mustChangePassword: user.mustChangePassword });
}
