import { Client } from "@microsoft/microsoft-graph-client";
import type { GraphAuth } from "./auth";

export interface MailMessage { id: string; subject?: string; hasAttachments?: boolean; }
export interface FileAttachment { id: string; name: string; contentBytes: string; contentType?: string; }

export class GraphClient {
  private client: Client;
  constructor(private auth: GraphAuth, private mailboxUpn: string) {
    this.client = Client.init({
      authProvider: async (done) => {
        try { done(null, await this.auth.getToken()); } catch (e) { done(e as Error, null); }
      },
    });
  }

  private base() { return `/users/${encodeURIComponent(this.mailboxUpn)}`; }

  async listInbox(top = 50): Promise<MailMessage[]> {
    const res = await this.client.api(`${this.base()}/mailFolders/inbox/messages`)
      .select("id,subject,hasAttachments").top(top).get();
    return res.value as MailMessage[];
  }

  async getFileAttachments(messageId: string): Promise<FileAttachment[]> {
    const res = await this.client.api(`${this.base()}/messages/${messageId}/attachments`).get();
    return (res.value as any[])
      .filter((a) => a["@odata.type"] === "#microsoft.graph.fileAttachment")
      .map((a) => ({ id: a.id, name: a.name, contentBytes: a.contentBytes, contentType: a.contentType }));
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.client.api(`${this.base()}/messages/${messageId}`).delete();
  }

  async ensureFolder(displayName: string): Promise<string> {
    const existing = await this.client.api(`${this.base()}/mailFolders`)
      .filter(`displayName eq '${displayName.replace(/'/g, "''")}'`).get();
    if (existing.value?.length) return existing.value[0].id;
    const created = await this.client.api(`${this.base()}/mailFolders`).post({ displayName });
    return created.id;
  }

  async moveMessage(messageId: string, destinationFolderId: string): Promise<void> {
    await this.client.api(`${this.base()}/messages/${messageId}/move`).post({ destinationId: destinationFolderId });
  }
}
