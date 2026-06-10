import type { GraphClient } from "./client";
import type { IngestResult } from "@/lib/ingest/ingest";
import { ingestAttachment } from "@/lib/ingest/ingest";

type IngestFn = (buf: Buffer, filename: string, messageId: string, dbPath?: string) => IngestResult;

const ERROR_FOLDER = "DMARC-Errors";

export async function processMailbox(
  client: GraphClient,
  opts: { deleteMode: "safe" | "hard"; dbPath?: string },
  ingest: IngestFn = ingestAttachment,
): Promise<{ processed: number; ingested: number; failed: number; duplicates: number }> {
  const messages = await client.listInbox();
  let ingested = 0, failed = 0, duplicates = 0;

  for (const msg of messages) {
    const attachments = await client.getFileAttachments(msg.id);
    let anyFailed = false, anySuccess = false;
    for (const att of attachments) {
      const buf = Buffer.from(att.contentBytes, "base64");
      const res = ingest(buf, att.name, msg.id, opts.dbPath);
      if (res.status === "ingested") { ingested++; anySuccess = true; }
      else if (res.status === "duplicate") { duplicates++; anySuccess = true; }
      else { failed++; anyFailed = true; }
    }

    const cleanlyHandled = attachments.length > 0 && !anyFailed;
    if (cleanlyHandled || opts.deleteMode === "hard") {
      await client.deleteMessage(msg.id);
    } else {
      const folderId = await client.ensureFolder(ERROR_FOLDER);
      await client.moveMessage(msg.id, folderId);
    }
    void anySuccess;
  }
  return { processed: messages.length, ingested, failed, duplicates };
}
