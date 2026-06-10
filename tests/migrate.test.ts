import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { migrate } from "@/lib/db/migrate";
import { closeDb } from "@/lib/db/connection";

const TMP = "data/test-migrate.db";
afterEach(() => { closeDb(); fs.rmSync(TMP, { force: true }); fs.rmSync(TMP + "-wal", { force: true }); fs.rmSync(TMP + "-shm", { force: true }); });

describe("migrate", () => {
  it("creates all tables", () => {
    const db = migrate(TMP);
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    for (const t of ["report","policy_published","record","auth_result_dkim","auth_result_spf","policy_override_reason","report_extension","ingest_log","setting","app_user","password_reset"])
      expect(names).toContain(t);
  });
});
