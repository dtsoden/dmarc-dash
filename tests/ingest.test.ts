import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import zlib from "node:zlib";
import { migrate } from "@/lib/db/migrate";
import { closeDb, getDb } from "@/lib/db/connection";
import { ingestAttachment } from "@/lib/ingest/ingest";

const TMP = "data/test-ingest.db";
afterEach(() => { closeDb(); for (const s of ["","-wal","-shm"]) fs.rmSync(TMP+s,{force:true}); });

describe("ingestAttachment", () => {
  it("ingests a gzipped report and logs success", () => {
    migrate(TMP);
    const xml = fs.readFileSync("tests/fixtures/google.xml");
    const gz = zlib.gzipSync(xml);
    const res = ingestAttachment(gz, "google.xml.gz", "msg-1", TMP);
    expect(res.status).toBe("ingested");
    expect(res.recordsIngested).toBe(1);
    const db = getDb(TMP);
    expect((db.prepare("SELECT COUNT(*) c FROM report").get() as any).c).toBe(1);
    expect((db.prepare("SELECT status FROM ingest_log").get() as any).status).toBe("ingested");
  });

  it("marks duplicate on second ingest", () => {
    migrate(TMP);
    const xml = fs.readFileSync("tests/fixtures/google.xml");
    ingestAttachment(xml, "g.xml", "m1", TMP);
    const res = ingestAttachment(xml, "g.xml", "m2", TMP);
    expect(res.status).toBe("duplicate");
  });

  it("logs failed status and does not throw on garbage", () => {
    migrate(TMP);
    const res = ingestAttachment(Buffer.from("not xml at all"), "bad.xml", "m3", TMP);
    expect(res.status).toBe("failed");
    const db = getDb(TMP);
    expect((db.prepare("SELECT status FROM ingest_log WHERE message_id='m3'").get() as any).status).toBe("failed");
  });
});
