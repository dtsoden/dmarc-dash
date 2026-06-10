import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { migrate } from "@/lib/db/migrate";
import { closeDb, getDb } from "@/lib/db/connection";
import { insertReport } from "@/lib/db/repository";
import type { DmarcReport } from "@/lib/ingest/model";

const TMP = "data/test-repo.db";
afterEach(() => { closeDb(); for (const s of ["","-wal","-shm"]) fs.rmSync(TMP+s, { force: true }); });

function sample(): DmarcReport {
  return {
    orgName: "google.com", reportId: "R1", dateBegin: 100, dateEnd: 200,
    policy: { domain: "example.com", p: "reject", adkim: "r", aspf: "r" },
    records: [{
      sourceIp: "1.2.3.4", sourceIpNorm: "1.2.3.4", count: 5,
      disposition: "none", dkimAligned: "pass", spfAligned: "fail",
      headerFrom: "example.com",
      authDkim: [{ domain: "example.com", selector: "s1", result: "pass" }],
      authSpf: [{ domain: "example.com", scope: "mfrom", result: "fail" }],
      reasons: [{ type: "forwarded" }],
    }],
  };
}

describe("insertReport", () => {
  it("inserts the full graph and returns inserted=true", () => {
    migrate(TMP);
    const r = insertReport(sample());
    expect(r.inserted).toBe(true);
    const db = getDb(TMP);
    expect((db.prepare("SELECT COUNT(*) c FROM record").get() as any).c).toBe(1);
    expect((db.prepare("SELECT COUNT(*) c FROM auth_result_dkim").get() as any).c).toBe(1);
    expect((db.prepare("SELECT SUM(count) s FROM record").get() as any).s).toBe(5);
  });

  it("dedups on (org_name, report_id, date_begin, date_end)", () => {
    migrate(TMP);
    insertReport(sample());
    const second = insertReport(sample());
    expect(second.inserted).toBe(false);
    const db = getDb(TMP);
    expect((db.prepare("SELECT COUNT(*) c FROM report").get() as any).c).toBe(1);
  });
});
