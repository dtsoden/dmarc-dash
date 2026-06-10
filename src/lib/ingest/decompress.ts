import zlib from "node:zlib";
import AdmZip from "adm-zip";

function isGzip(b: Buffer) { return b.length > 2 && b[0] === 0x1f && b[1] === 0x8b; }
function isZip(b: Buffer) { return b.length > 3 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05); }

function decodeText(buf: Buffer): string {
  // DMARC XML is ASCII/UTF-8 in practice; strip a UTF-8 BOM, fall back to latin1 on invalid UTF-8.
  let s = buf.toString("utf8");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  if (s.includes("�")) s = buf.toString("latin1");
  return s;
}

export function decompressToXml(buf: Buffer, filename = ""): string {
  if (isGzip(buf)) return decodeText(zlib.gunzipSync(buf));
  if (isZip(buf)) {
    const zip = new AdmZip(buf);
    const entry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith(".xml"))
      ?? zip.getEntries().find((e) => !e.isDirectory);
    if (!entry) throw new Error(`zip ${filename} has no usable entry`);
    return decodeText(entry.getData());
  }
  return decodeText(buf);
}
