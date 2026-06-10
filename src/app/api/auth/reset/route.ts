import { NextResponse } from "next/server";
import { consumeReset } from "@/lib/auth/reset";

export async function POST(req: Request) {
  const { token, password } = await req.json();
  if (!password || password.length < 8) return NextResponse.json({ error: "Password too short" }, { status: 400 });
  const ok = consumeReset(token ?? "", password);
  if (!ok) return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
