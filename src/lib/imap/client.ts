import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { MailMessage, FileAttachment } from "@/lib/mailbox/source";

export interface ImapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
  folder: string;
}

// IMAP mailbox source (basic auth / app password). Implements the same surface as the
// Graph client so the ingest pipeline is provider-agnostic.
export class ImapSource {
  private client: ImapFlow;
  private folder: string;
  private exists = 0;
  private trashPath: string | undefined;

  constructor(cfg: ImapConfig) {
    this.folder = cfg.folder || "INBOX";
    this.client = new ImapFlow({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.tls,
      auth: { user: cfg.username, pass: cfg.password },
      logger: false,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    const mb = await this.client.mailboxOpen(this.folder);
    this.exists = mb.exists;
  }

  async close(): Promise<void> {
    try { await this.client.logout(); } catch { /* ignore */ }
  }

  async listInbox(top = 50): Promise<MailMessage[]> {
    if (this.exists === 0) return [];
    const start = Math.max(1, this.exists - top + 1);
    const out: MailMessage[] = [];
    for await (const msg of this.client.fetch(`${start}:*`, { uid: true, envelope: true })) {
      out.push({ id: String(msg.uid), subject: msg.envelope?.subject ?? "" });
    }
    return out;
  }

  async getFileAttachments(messageId: string): Promise<FileAttachment[]> {
    const uid = Number(messageId);
    const msg = await this.client.fetchOne(String(uid), { source: true }, { uid: true });
    if (!msg || !msg.source) return [];
    const parsed = await simpleParser(msg.source);
    return (parsed.attachments ?? []).map((a, i) => ({
      id: String(i),
      name: a.filename ?? `attachment-${i}`,
      contentBytes: Buffer.from(a.content).toString("base64"),
      contentType: a.contentType,
    }));
  }

  private async resolveTrash(): Promise<string | undefined> {
    if (this.trashPath !== undefined) return this.trashPath || undefined;
    try {
      const list = await this.client.list();
      const t = list.find((m) => Array.isArray(m.flags) ? false : m.specialUse === "\\Trash")
        ?? list.find((m) => /^trash$/i.test(m.name) || /\/Trash$/i.test(m.path));
      this.trashPath = t?.path ?? "";
      return this.trashPath || undefined;
    } catch { this.trashPath = ""; return undefined; }
  }

  // Soft delete: move to Trash if the server exposes one, else flag \Deleted.
  async deleteMessage(messageId: string): Promise<void> {
    const trash = await this.resolveTrash();
    if (trash) { await this.client.messageMove(messageId, trash, { uid: true }); return; }
    await this.client.messageFlagsAdd(messageId, ["\\Deleted"], { uid: true });
  }

  async ensureFolder(displayName: string): Promise<string> {
    try { await this.client.mailboxCreate(displayName); } catch { /* already exists */ }
    return displayName;
  }

  async moveMessage(messageId: string, destinationFolderId: string): Promise<void> {
    await this.client.messageMove(messageId, destinationFolderId, { uid: true });
  }
}
