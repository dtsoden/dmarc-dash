import type { MailSource } from "@/lib/mailbox/source";
import type { IngestResult } from "@/lib/ingest/ingest";
import { ingestAttachment } from "@/lib/ingest/ingest";

type IngestFn = (buf: Buffer, filename: string, messageId: string, dbPath?: string) => IngestResult;

const ERROR_FOLDER = "DMARC-Errors";

// A DMARC aggregate report arrives as a compressed/plain XML attachment. Only these
// extensions are ever considered. Normal attachments (.pdf, .txt, .docx, images, files
// with no extension, etc.) are NEVER touched.
const REPORT_FILE = /\.(xml|xml\.gz|gz|zip)$/i;
// RFC 9990 / 7489 report subject line.
const REPORT_SUBJECT = /report domain:/i;

export interface MailboxResult {
  processed: number;   // total inbox messages examined
  skipped: number;     // non-DMARC messages left completely untouched
  ingested: number;
  duplicates: number;
  failed: number;
  deleted: number;
  movedToErrors: number;
}

export async function processMailbox(
  client: MailSource,
  opts: { deleteMode: "safe" | "hard"; dbPath?: string },
  ingest: IngestFn = ingestAttachment,
): Promise<MailboxResult> {
  const messages = await client.listInbox();
  const r: MailboxResult = { processed: messages.length, skipped: 0, ingested: 0, duplicates: 0, failed: 0, deleted: 0, movedToErrors: 0 };

  for (const msg of messages) {
    const attachments = await client.getFileAttachments(msg.id);
    const reportAtts = attachments.filter((a) => REPORT_FILE.test(a.name));
    const subjectIsReport = REPORT_SUBJECT.test(msg.subject ?? "");

    // Not a DMARC report email at all: no report-type attachment and no report subject.
    // Leave it ALONE. This is the critical guard: ordinary mail is never moved or deleted.
    if (reportAtts.length === 0 && !subjectIsReport) {
      r.skipped++;
      continue;
    }

    // This message is a DMARC report (or claims to be via its subject). Only its
    // report-type attachments are ever parsed; other attachments on it are ignored.
    let anySuccess = false, anyFailed = false;
    for (const att of reportAtts) {
      const buf = Buffer.from(att.contentBytes, "base64");
      const res = ingest(buf, att.name, msg.id, opts.dbPath);
      if (res.status === "ingested") { r.ingested++; anySuccess = true; }
      else if (res.status === "duplicate") { r.duplicates++; anySuccess = true; }
      else { r.failed++; anyFailed = true; }
    }

    const handledCleanly = anySuccess && !anyFailed;
    if (handledCleanly || opts.deleteMode === "hard") {
      await client.deleteMessage(msg.id);
      r.deleted++;
    } else {
      // A genuine-but-unparseable report (or a report-subject email whose attachment is
      // missing/broken). Keep it for review in DMARC-Errors. Only DMARC mail reaches here.
      const folderId = await client.ensureFolder(ERROR_FOLDER);
      await client.moveMessage(msg.id, folderId);
      r.movedToErrors++;
    }
  }
  return r;
}
