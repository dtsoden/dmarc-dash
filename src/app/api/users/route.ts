import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import { listUsers, createUser } from "@/lib/auth/users";

async function ensureAdmin() { const s = await getSession(); return s.loggedIn && s.role === "admin"; }

export async function GET() {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(listUsers());
}

export async function POST(req: Request) {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { username, email, password, role } = await req.json();
  if (!username || !email || !password || password.length < 8 || !["admin","analyst","viewer"].includes(role))
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    const u = createUser({ username, email, password, role, mustChangePassword: true });
    return NextResponse.json(u);
  } catch {
    return NextResponse.json({ error: "Username or email already exists" }, { status: 409 });
  }
}
