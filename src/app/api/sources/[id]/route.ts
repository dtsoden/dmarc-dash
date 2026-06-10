import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import { updateSource, deleteSource, getSourceRow, validateSourceInput } from "@/lib/mailbox/store";
import { applySettingsChange } from "@/lib/scheduler";

const MASK = "********";
async function ensureAdmin() { const s = await getSession(); return s.loggedIn && s.role === "admin"; }

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number((await params).id);
  if (!getSourceRow(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json();
  // Masked/blank secrets mean "keep stored value": drop them so they aren't overwritten.
  if (b.graph && (b.graph.clientSecret === MASK || b.graph.clientSecret === "")) delete b.graph.clientSecret;
  if (b.imap && (b.imap.password === MASK || b.imap.password === "")) delete b.imap.password;
  const err = validateSourceInput(b, false);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  try {
    updateSource(id, b);
    applySettingsChange();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const dup = /UNIQUE/i.test(String(e?.message ?? e));
    return NextResponse.json({ error: dup ? "That domain already has a mailbox configured." : "Update failed" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  deleteSource(Number((await params).id));
  applySettingsChange();
  return NextResponse.json({ ok: true });
}
