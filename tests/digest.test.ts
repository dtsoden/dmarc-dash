import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { migrate } from "@/lib/db/migrate";
import { closeDb } from "@/lib/db/connection";
import { ingestAttachment } from "@/lib/ingest/ingest";
import { buildDigestHtml } from "@/lib/email/digest";

const TMP = "data/test-digest.db";
afterEach(() => { closeDb(); for (const s of ["","-wal","-shm"]) fs.rmSync(TMP+s,{force:true}); });

describe("buildDigestHtml", () => {
  it("renders compliance and top sources into HTML", () => {
    migrate(TMP);
    for (const f of ["google.xml","microsoft.xml","rfc9990.xml"])
      ingestAttachment(fs.readFileSync(`tests/fixtures/${f}`), f, "m-"+f, TMP);
    const { subject, html } = buildDigestHtml(TMP, "weekly", { from: 0, to: 9_999_999_999 }, 0);
    expect(subject).toMatch(/Weekly DMARC/i);
    expect(html).toContain("12"); // total messages
    expect(html).toContain("40.92.0.1"); // a top source
    expect(html).toMatch(/%/); // a compliance percentage
  });
});
