import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { parseDmarcXml } from "@/lib/ingest/parse";

const read = (f: string) => fs.readFileSync(`tests/fixtures/${f}`, "utf8");

describe("parseDmarcXml", () => {
  it("parses legacy google report with multiple dkim results", () => {
    const r = parseDmarcXml(read("google.xml"), "google.xml");
    expect(r.orgName).toBe("google.com");
    expect(r.reportId).toBe("12345678901234567890");
    expect(r.dateBegin).toBe(1717200000);
    expect(r.policy.p).toBe("reject");
    expect(r.policy.pct).toBe(100);
    expect(r.records).toHaveLength(1);
    expect(r.records[0].count).toBe(2);
    expect(r.records[0].dkimAligned).toBe("pass");
    expect(r.records[0].spfAligned).toBe("fail");
    expect(r.records[0].authDkim).toHaveLength(2);
    expect(r.records[0].authSpf).toHaveLength(1);
  });

  it("parses microsoft report lacking xml declaration, with override reason", () => {
    const r = parseDmarcXml(read("microsoft.xml"), "microsoft.xml");
    expect(r.orgName).toBe("Enterprise Outlook");
    expect(r.records[0].count).toBe(7);
    expect(r.records[0].reasons[0].type).toBe("mailing_list");
    expect(r.records[0].authDkim).toHaveLength(1);
  });

  it("parses rfc9990 report with np/testing/generator and disposition pass", () => {
    const r = parseDmarcXml(read("rfc9990.xml"), "rfc9990.xml");
    expect(r.schemaNamespace).toBe("urn:ietf:params:xml:ns:dmarc-2.0");
    expect(r.generator).toBe("Yahoo DMARC 2.0");
    expect(r.policy.np).toBe("reject");
    expect(r.policy.testing).toBe("n");
    expect(r.policy.discoveryMethod).toBe("treewalk");
    expect(r.records[0].disposition).toBe("pass");
    expect(r.records[0].sourceIp).toBe("2001:4860:4860::8888");
  });

  it("normalizes source_ip", () => {
    const r = parseDmarcXml(read("google.xml"), "google.xml");
    expect(r.records[0].sourceIpNorm).toBe("209.85.220.41");
  });
});
