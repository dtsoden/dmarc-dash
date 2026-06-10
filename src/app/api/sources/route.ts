import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import { listSourcesSafe, createSource, validateSourceInput } from "@/lib/mailbox/store";
import { applySettingsChange } from "@/lib/scheduler";

async function ensureAdmin() { const s = await getSession(); return s.loggedIn && s.role === "admin"; }

export async function GET() {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(listSourcesSafe());
}

export async function POST(req: Request) {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json();
  const err = validateSourceInput(b, true);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  try {
    const id = createSource(b);
    applySettingsChange();
    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    const dup = /UNIQUE/i.test(String(e?.message ?? e));
    return NextResponse.json({ error: dup ? "That domain already has a mailbox configured." : "Failed to create source" }, { status: 400 });
  }
}
