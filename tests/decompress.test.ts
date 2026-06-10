import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import { decompressToXml } from "@/lib/ingest/decompress";

const XML = `<?xml version="1.0"?><feedback><report_metadata><org_name>x</org_name></report_metadata></feedback>`;

describe("decompressToXml", () => {
  it("passes through plain xml bytes", () => {
    expect(decompressToXml(Buffer.from(XML, "utf8"), "r.xml")).toContain("<feedback>");
  });
  it("inflates gzip", () => {
    const gz = zlib.gzipSync(Buffer.from(XML, "utf8"));
    expect(decompressToXml(gz, "r.xml.gz")).toContain("<org_name>x</org_name>");
  });
  it("extracts first xml entry from a zip", () => {
    // minimal zip via zlib deflateRaw + manual local header is complex; use a real zip lib path.
    // Build a zip using the same code path the impl uses (adm-zip) to keep the test honest.
    const AdmZip = require("adm-zip");
    const z = new AdmZip();
    z.addFile("report.xml", Buffer.from(XML, "utf8"));
    expect(decompressToXml(z.toBuffer(), "r.zip")).toContain("<feedback>");
  });
});
