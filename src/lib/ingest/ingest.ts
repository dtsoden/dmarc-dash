import { getDb } from "@/lib/db/connection";
import { insertReport } from "@/lib/db/repository";
import { decompressToXml } from "./decompress";
import { parseDmarcXml, collectUnknownFields } from "./parse";

export type IngestStatus = "ingested" | "duplicate" | "failed";
export interface IngestResult { status: IngestStatus; recordsIngested: number; error?: string; }

function logIngest(dbPath: string | undefined, row: {
  filename: string; reporter: string | null; status: IngestStatus;
  records: number; dropped: string[]; messageId: string; error?: string;
}) {
  getDb(dbPath).prepare(
    `INSERT INTO ingest_log (filename,reporter,status,records_ingested,dropped_fields,message_id,error_detail,processed_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(row.filename, row.reporter, row.status, row.records,
    row.dropped.length ? JSON.stringify(row.dropped) : null, row.messageId,
    row.error ?? null, Math.floor(Date.now() / 1000));
}

export function ingestAttachment(buf: Buffer, filename: string, messageId: string, dbPath?: string): IngestResult {
  try {
    const xml = decompressToXml(buf, filename);
    const report = parseDmarcXml(xml, filename);
    const dropped = collectUnknownFields(xml);
    const { inserted } = insertReport(report, dbPath);
    const status: IngestStatus = inserted ? "ingested" : "duplicate";
    const records = inserted ? report.records.length : 0;
    logIngest(dbPath, { filename, reporter: report.orgName, status, records, dropped, messageId });
    return { status, recordsIngested: records };
  } catch (e: any) {
    logIngest(dbPath, { filename, reporter: null, status: "failed", records: 0, dropped: [], messageId, error: String(e?.message ?? e) });
    return { status: "failed", recordsIngested: 0, error: String(e?.message ?? e) };
  }
}
