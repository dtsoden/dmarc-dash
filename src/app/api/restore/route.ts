import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { isWizardOrAdmin } from "@/lib/auth/guard";
import { bootstrap } from "@/lib/config";
import { closeDb } from "@/lib/db/connection";

// POST /api/restore  (multipart, field "file" = a backup zip from /api/backup)
//
// Unpacks the archive over the data volume: database, app.key, GeoIP db, and brand
// assets all come back exactly as they were. Because the encryption key travels with
// the encrypted credentials, a fresh ephemeral instance becomes a perfect clone.
//
// Allowed during first-run setup (no admin yet) OR for a logged-in admin, so you can
// stand up a blank container and restore straight into it. After writing the files the
// process exits; the container restart policy brings it back up with the restored data,
// a fresh DB handle, the restored encryption key, and a cleared settings cache.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB ceiling (GeoLite db is the big item)

export async function POST(req: Request) {
  if (!(await isWizardOrAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Backup file is too large" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());

  let entries: AdmZip.IZipEntry[];
  try {
    entries = new AdmZip(buf).getEntries();
  } catch {
    return NextResponse.json({ error: "Not a valid zip archive" }, { status: 400 });
  }

  const { dataDir, dbPath } = bootstrap();
  const root = path.resolve(dataDir);
  const dbName = path.basename(dbPath);

  // Sanity: a real backup always carries the database. Refuse anything else so we never
  // wipe the data volume with an unrelated zip.
  const hasDb = entries.some((e) => !e.isDirectory && path.basename(e.entryName) === dbName);
  if (!hasDb) {
    return NextResponse.json({ error: `Not a DMARC Dashboard backup (no ${dbName} inside)` }, { status: 400 });
  }

  // Guard against zip-slip: every target must resolve inside the data directory.
  const planned: Array<{ entry: AdmZip.IZipEntry; target: string }> = [];
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const target = path.resolve(root, entry.entryName);
    if (target !== root && !target.startsWith(root + path.sep)) {
      return NextResponse.json({ error: "Backup contains an unsafe path" }, { status: 400 });
    }
    planned.push({ entry, target });
  }

  try {
    // Release our handle before overwriting the database file.
    closeDb();
    fs.mkdirSync(root, { recursive: true });
    for (const { entry, target } of planned) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, entry.getData());
    }
    // The archive holds a checkpointed db; drop any stale WAL/SHM so the restored file
    // is authoritative on next open.
    for (const suffix of ["-wal", "-shm"]) {
      try { fs.rmSync(dbPath + suffix, { force: true }); } catch { /* best effort */ }
    }
  } catch (err) {
    console.error("[restore] failed", err);
    return NextResponse.json({ error: "Restore failed while writing files" }, { status: 500 });
  }

  // Restart so everything reloads from the restored volume. The response is sent first;
  // the timeout fires after it flushes.
  console.log("[restore] data volume restored, restarting process");
  setTimeout(() => process.exit(0), 1000);
  return NextResponse.json({ ok: true, restart: true });
}
