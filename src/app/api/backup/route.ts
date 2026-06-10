import { NextResponse } from "next/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { getSession } from "@/lib/auth/guard";
import { bootstrap } from "@/lib/config";
import { getDb } from "@/lib/db/connection";

// GET /api/backup -> streams a zip of the ENTIRE data volume (database + app.key +
// GeoLite2 db + brand assets + anything else living in DATA_DIR). Restoring is just
// "unzip into the data folder" on any other host: same encryption key travels with
// the encrypted credentials, so the copy is self-consistent and fully portable.
//
// Admin only. The archive contains the encryption key and encrypted mailbox
// secrets, so it must never be reachable without an admin session.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live SQLite files we never copy raw: in WAL mode the .db on disk can lag behind
// the -wal log, so a naive copy may be inconsistent. We add a checkpointed snapshot
// (taken with better-sqlite3's online backup) under the canonical name instead.
const LIVE_DB_FILES = new Set(["dmarc.db", "dmarc.db-wal", "dmarc.db-shm"]);

// Collect every file under `dir` as [absolutePath, posixRelativePath] pairs.
function walk(dir: string, base = dir): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(abs, base));
    } else if (entry.isFile()) {
      const rel = path.relative(base, abs).split(path.sep).join("/");
      out.push([abs, rel]);
    }
  }
  return out;
}

export async function GET() {
  const s = await getSession();
  if (!s.loggedIn || s.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { dataDir, dbPath } = bootstrap();
  if (!fs.existsSync(dataDir)) {
    return NextResponse.json({ error: "Data directory not found" }, { status: 500 });
  }

  // Consistent point-in-time snapshot of the database (outside the data dir so the
  // walk below never picks it up).
  const snapshot = path.join(os.tmpdir(), `dmarc-snapshot-${Date.now()}-${process.pid}.db`);
  try {
    await getDb().backup(snapshot);

    const zip = new AdmZip();
    for (const [abs, rel] of walk(dataDir)) {
      if (LIVE_DB_FILES.has(path.basename(rel))) continue; // snapshot replaces these
      const dir = path.posix.dirname(rel);
      zip.addLocalFile(abs, dir === "." ? "" : dir);
    }
    // The canonical, checkpointed database.
    zip.addLocalFile(snapshot, "", path.basename(dbPath));

    const buf = zip.toBuffer();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="dmarc-backup-${stamp}.zip"`,
        "Content-Length": String(buf.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[backup] failed", err);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  } finally {
    try { fs.rmSync(snapshot, { force: true }); } catch { /* best effort */ }
  }
}
