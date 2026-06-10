import { getSetting } from "@/lib/settings";
import { GraphAuth } from "@/lib/graph/auth";
import { GraphClient } from "@/lib/graph/client";
import { ImapSource } from "@/lib/imap/client";

export interface MailMessage { id: string; subject?: string; hasAttachments?: boolean }
export interface FileAttachment { id: string; name: string; contentBytes: string; contentType?: string }

// Provider-agnostic mailbox surface used by the ingest pipeline. Both GraphClient and
// ImapSource implement this structurally.
export interface MailSource {
  listInbox(top?: number): Promise<MailMessage[]>;
  getFileAttachments(messageId: string): Promise<FileAttachment[]>;
  deleteMessage(messageId: string): Promise<void>;
  ensureFolder(displayName: string): Promise<string>;
  moveMessage(messageId: string, destinationFolderId: string): Promise<void>;
}

export type Provider = "graph" | "imap" | "";

export function activeProvider(): Provider {
  return (getSetting<string>("mailbox_provider") as Provider) || "";
}

// Build the configured source. Returns null when no source is configured/usable.
// Caller MUST call close() when done (no-op for Graph, logout for IMAP).
export async function createActiveSource(): Promise<{ source: MailSource; close: () => Promise<void> } | null> {
  const provider = activeProvider();

  if (provider === "graph") {
    const tenantId = getSetting<string>("graph_tenant_id");
    const clientId = getSetting<string>("graph_client_id");
    const clientSecret = getSetting<string>("graph_client_secret");
    const mailbox = getSetting<string>("mailbox_upn");
    if (!tenantId || !clientId || !clientSecret || !mailbox) return null;
    const client = new GraphClient(new GraphAuth({ tenantId, clientId, clientSecret }), mailbox);
    return { source: client, close: async () => {} };
  }

  if (provider === "imap") {
    const host = getSetting<string>("imap_host");
    const username = getSetting<string>("imap_username");
    const password = getSetting<string>("imap_password");
    if (!host || !username || !password) return null;
    const src = new ImapSource({
      host,
      port: getSetting<number>("imap_port") || 993,
      username,
      password,
      tls: getSetting<boolean>("imap_tls"),
      folder: getSetting<string>("imap_folder") || "INBOX",
    });
    await src.connect();
    return { source: src, close: () => src.close() };
  }

  return null;
}

// One-shot connection test for the wizard/settings "Test connection" button.
export async function testGraph(c: { tenantId: string; clientId: string; clientSecret: string; mailboxUpn: string }) {
  const client = new GraphClient(new GraphAuth({ tenantId: c.tenantId, clientId: c.clientId, clientSecret: c.clientSecret }), c.mailboxUpn);
  const msgs = await client.listInbox(1);
  return msgs.length;
}

export async function testImap(c: { host: string; port: number; username: string; password: string; tls: boolean; folder: string }) {
  const src = new ImapSource(c);
  await src.connect();
  try { const msgs = await src.listInbox(1); return msgs.length; }
  finally { await src.close(); }
}
