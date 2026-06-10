import { NextResponse } from "next/server";
import fs from "node:fs";
import { isWizardOrAdmin } from "@/lib/auth/guard";
import { setSetting } from "@/lib/settings";
import { brandDir, brandFilePath, getBrand, mimeForExt, extFromName } from "@/lib/brand";

// GET  /api/brand/logo|favicon  -> serves the uploaded asset (public; needed in <head>/<img>)
// POST /api/brand/logo|favicon  -> admin uploads (multipart, field "file")
// DELETE /api/brand/logo|favicon -> admin removes the custom asset

const ALLOWED: Record<string, string[]> = {
  logo: ["svg", "png", "jpg", "jpeg", "webp"],
  favicon: ["svg", "png", "ico"],
};
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function validKind(kind: string): kind is "logo" | "favicon" {
  return kind === "logo" || kind === "favicon";
}

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!validKind(kind)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ext = kind === "logo" ? getBrand().logoExt : getBrand().faviconExt;
  if (!ext) return NextResponse.json({ error: "No asset" }, { status: 404 });
  const p = brandFilePath(kind, ext);
  if (!fs.existsSync(p)) return NextResponse.json({ error: "No asset" }, { status: 404 });
  const body = fs.readFileSync(p);
  return new NextResponse(body, {
    headers: { "Content-Type": mimeForExt(ext), "Cache-Control": "no-cache" },
  });
}

async function ensureAdmin() { return isWizardOrAdmin(); }

export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { kind } = await params;
  if (!validKind(kind)) return NextResponse.json({ error: "Bad kind" }, { status: 400 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  const ext = extFromName(file.name);
  if (!ALLOWED[kind].includes(ext)) {
    return NextResponse.json({ error: `Allowed: ${ALLOWED[kind].join(", ")}` }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) return NextResponse.json({ error: "File too large (max 2 MB)" }, { status: 400 });

  fs.mkdirSync(brandDir(), { recursive: true });
  // Remove any previous asset of a different extension to avoid stale files.
  const prevExt = kind === "logo" ? getBrand().logoExt : getBrand().faviconExt;
  if (prevExt && prevExt !== ext) { try { fs.rmSync(brandFilePath(kind, prevExt), { force: true }); } catch {} }
  fs.writeFileSync(brandFilePath(kind, ext), buf);
  setSetting(kind === "logo" ? "brand_logo_ext" : "brand_favicon_ext", ext);
  return NextResponse.json({ ok: true, ext });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { kind } = await params;
  if (!validKind(kind)) return NextResponse.json({ error: "Bad kind" }, { status: 400 });
  const ext = kind === "logo" ? getBrand().logoExt : getBrand().faviconExt;
  if (ext) { try { fs.rmSync(brandFilePath(kind, ext), { force: true }); } catch {} }
  setSetting(kind === "logo" ? "brand_logo_ext" : "brand_favicon_ext", "");
  return NextResponse.json({ ok: true });
}
