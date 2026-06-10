import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import { updateUser, setPassword, deleteUser, getUserById } from "@/lib/auth/users";
import { canRemoveAdmin } from "@/lib/auth/users-guard";

async function ensureAdmin() { const s = await getSession(); return s.loggedIn && s.role === "admin"; }

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number((await params).id);
  const body = await req.json();
  const target = getUserById(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const demoting = body.role && body.role !== "admin" && target.role === "admin";
  const deactivating = body.isActive === false && target.role === "admin";
  if ((demoting || deactivating) && !canRemoveAdmin(id))
    return NextResponse.json({ error: "Cannot remove the last administrator" }, { status: 400 });
  if (body.password) { if (body.password.length < 8) return NextResponse.json({ error: "Password too short" }, { status: 400 }); setPassword(id, body.password); }
  updateUser(id, { role: body.role, isActive: body.isActive, email: body.email });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number((await params).id);
  if (!canRemoveAdmin(id)) return NextResponse.json({ error: "Cannot delete the last administrator" }, { status: 400 });
  deleteUser(id);
  return NextResponse.json({ ok: true });
}
