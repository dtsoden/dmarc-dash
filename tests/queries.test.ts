import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { migrate } from "@/lib/db/migrate";
import { closeDb } from "@/lib/db/connection";
import { ingestAttachment } from "@/lib/ingest/ingest";
import { overviewKpis, volumeByDay, topSources, dispositionBreakdown } from "@/lib/db/queries";

const TMP = "data/test-queries.db";
afterEach(() => { closeDb(); for (const s of ["","-wal","-shm"]) fs.rmSync(TMP+s,{force:true}); });

function seed() {
  migrate(TMP);
  for (const f of ["google.xml","microsoft.xml","rfc9990.xml"])
    ingestAttachment(fs.readFileSync(`tests/fixtures/${f}`), f, "m-"+f, TMP);
}

describe("queries", () => {
  it("overviewKpis sums counts and computes pass rates", () => {
    seed();
    const k = overviewKpis(TMP, {});
    // google count2 (dkim pass), microsoft count7 (both fail), rfc9990 count3 (both pass)
    expect(k.totalMessages).toBe(12);
    // DMARC pass = dkim_aligned pass OR spf_aligned pass: google(2)+rfc9990(3)=5
    expect(k.dmarcPass).toBe(5);
    expect(k.distinctSources).toBe(3);
  });

  it("dispositionBreakdown groups by disposition", () => {
    seed();
    const d = dispositionBreakdown(TMP, {});
    const map = Object.fromEntries(d.map((r) => [r.disposition, r.messages]));
    expect(map["none"]).toBe(2);
    expect(map["quarantine"]).toBe(7);
    expect(map["pass"]).toBe(3);
  });

  it("topSources returns sources ordered by volume", () => {
    seed();
    const s = topSources(TMP, {}, 10);
    expect(s[0].messages).toBeGreaterThanOrEqual(s[s.length - 1].messages);
    expect(s.some((r) => r.sourceIp === "40.92.0.1")).toBe(true);
  });

  it("volumeByDay returns rows keyed by day", () => {
    seed();
    const v = volumeByDay(TMP, {});
    expect(v.length).toBeGreaterThan(0);
    expect(v[0]).toHaveProperty("day");
    expect(v[0]).toHaveProperty("pass");
    expect(v[0]).toHaveProperty("fail");
  });
});
