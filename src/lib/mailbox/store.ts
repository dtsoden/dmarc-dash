import { getDb } from "@/lib/db/connection";
import { bootstrap } from "@/lib/config";
import { getOrCreateKey, encryptSecret, decryptSecret } from "@/lib/crypto";
import { getSetting } from "@/lib/settings";
import { GraphAuth } from "@/lib/graph/auth";
import { GraphClient } from "@/lib/graph/client";
import { ImapSource } from "@/lib/imap/client";
import type { MailSource } from "./source";

export type Provider = "graph" | "imap";

export interface MailboxSourceInput {
  domain: string;
  provider: Provider;
  graph?: { tenantId: string; clientId: string; clientSecret: string; mailboxUpn: string };
  imap?: { host: string; port: number; username: string; password: string; tls: boolean; folder: string };
}

export interface MailboxSourceSafe {
  id: number; domain: string; provider: Provider; isActive: boolean;
  graphTenantId: string; graphClientId: string; mailboxUpn: string;
  imapHost: string; imapPort: number; imapUsername: string; imapTls: boolean; imapFolder: string;
  hasGraphSecret: boolean; hasImapPassword: boolean;
  lastPollAt: number | null; lastPollStatus: string | null; lastPollDetail: string | null;
}

function key(keyPath?: string) { return getOrCreateKey(keyPath ?? bootstrap().keyPath); }
function enc(v: string | undefined, keyPath?: string) { return v ? encryptSecret(v, key(keyPath)) : ""; }
function dec(v: string | undefined | null, keyPath?: string) { return v ? decryptSecret(v, key(keyPath)) : ""; }

const DOMAIN_RE = /^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/i;

// Validate a source input. When requireSecrets is false (edit of an existing source),
// blank secret fields are allowed (they mean "keep the stored secret").
export function validateSourceInput(b: any, requireSecrets = true): string | null {
  if (!b || typeof b.domain !== "string" || !DOMAIN_RE.test(b.domain.trim())) return "Enter a valid domain name, e.g. example.com.";
  if (b.provider !== "graph" && b.provider !== "imap") return "Choose a mailbox provider.";
  if (b.provider === "graph") {
    const g = b.graph || {};
    if (!g.tenantId || !g.clientId || (requireSecrets && !g.clientSecret) || !g.mailboxUpn) return "All Microsoft 365 fields are required.";
  } else {
    const i = b.imap || {};
    if (!i.host || !i.username || (requireSecrets && !i.password)) return "IMAP host, username and password are required.";
  }
  return null;
}

export function countSources(dbPath?: string): number {
  return (getDb(dbPath).prepare(`SELECT COUNT(*) c FROM mailbox_source`).get() as any).c;
}

export function getSourceRow(id: number, dbPath?: string): any {
  return getDb(dbPath).prepare(`SELECT * FROM mailbox_source WHERE id=?`).get(id);
}

export function listSourcesSafe(dbPath?: string): MailboxSourceSafe[] {
  const rows = getDb(dbPath).prepare(`SELECT * FROM mailbox_source ORDER BY domain`).all() as any[];
  return rows.map((r) => ({
    id: r.id, domain: r.domain, provider: r.provider, isActive: !!r.is_active,
    graphTenantId: r.graph_tenant_id ?? "", graphClientId: r.graph_client_id ?? "", mailboxUpn: r.mailbox_upn ?? "",
    imapHost: r.imap_host ?? "", imapPort: r.imap_port ?? 993, imapUsername: r.imap_username ?? "",
    imapTls: !!r.imap_tls, imapFolder: r.imap_folder ?? "INBOX",
    hasGraphSecret: !!r.graph_client_secret, hasImapPassword: !!r.imap_password,
    lastPollAt: r.last_poll_at ?? null, lastPollStatus: r.last_poll_status ?? null, lastPollDetail: r.last_poll_detail ?? null,
  }));
}

export function createSource(input: MailboxSourceInput, dbPath?: string, keyPath?: string): number {
  return getDb(dbPath).prepare(`INSERT INTO mailbox_source
    (domain, provider, graph_tenant_id, graph_client_id, graph_client_secret, mailbox_upn,
     imap_host, imap_port, imap_username, imap_password, imap_tls, imap_folder, is_active, created_at)
    VALUES (@domain,@provider,@gt,@gc,@gs,@mu,@ih,@ip,@iu,@ipw,@itls,@ifo,1,@now)`).run({
      domain: input.domain.trim().toLowerCase(), provider: input.provider,
      gt: input.graph?.tenantId ?? null, gc: input.graph?.clientId ?? null,
      gs: enc(input.graph?.clientSecret, keyPath) || null, mu: input.graph?.mailboxUpn ?? null,
      ih: input.imap?.host ?? null, ip: input.imap?.port ?? 993, iu: input.imap?.username ?? null,
      ipw: enc(input.imap?.password, keyPath) || null,
      itls: input.imap ? (input.imap.tls ? 1 : 0) : 1, ifo: input.imap?.folder ?? "INBOX",
      now: Math.floor(Date.now() / 1000),
    }).lastInsertRowid as number;
}

export function updateSource(id: number, input: Partial<MailboxSourceInput>, dbPath?: string, keyPath?: string): void {
  const cur = getSourceRow(id, dbPath);
  if (!cur) return;
  const g = input.graph; const i = input.imap;
  getDb(dbPath).prepare(`UPDATE mailbox_source SET
    domain=@domain, provider=@provider,
    graph_tenant_id=@gt, graph_client_id=@gc, graph_client_secret=@gs, mailbox_upn=@mu,
    imap_host=@ih, imap_port=@ip, imap_username=@iu, imap_password=@ipw, imap_tls=@itls, imap_folder=@ifo
    WHERE id=@id`).run({
      id, domain: (input.domain ?? cur.domain).trim().toLowerCase(), provider: input.provider ?? cur.provider,
      gt: g?.tenantId ?? cur.graph_tenant_id, gc: g?.clientId ?? cur.graph_client_id,
      gs: g && g.clientSecret ? enc(g.clientSecret, keyPath) : cur.graph_client_secret,
      mu: g?.mailboxUpn ?? cur.mailbox_upn,
      ih: i?.host ?? cur.imap_host, ip: i?.port ?? cur.imap_port, iu: i?.username ?? cur.imap_username,
      ipw: i && i.password ? enc(i.password, keyPath) : cur.imap_password,
      itls: i ? (i.tls ? 1 : 0) : cur.imap_tls, ifo: i?.folder ?? cur.imap_folder,
    });
}

export function deleteSource(id: number, dbPath?: string): void {
  getDb(dbPath).prepare(`DELETE FROM mailbox_source WHERE id=?`).run(id);
}

export function recordPoll(id: number, status: string, detail: string, dbPath?: string): void {
  getDb(dbPath).prepare(`UPDATE mailbox_source SET last_poll_at=?, last_poll_status=?, last_poll_detail=? WHERE id=?`)
    .run(Math.floor(Date.now() / 1000), status, (detail ?? "").slice(0, 500), id);
}

// Build a live MailSource for a row (decrypting secrets). Caller MUST close.
export async function buildSourceClient(row: any, keyPath?: string): Promise<{ source: MailSource; close: () => Promise<void> }> {
  if (row.provider === "graph") {
    const auth = new GraphAuth({ tenantId: row.graph_tenant_id, clientId: row.graph_client_id, clientSecret: dec(row.graph_client_secret, keyPath) });
    return { source: new GraphClient(auth, row.mailbox_upn), close: async () => {} };
  }
  const src = new ImapSource({ host: row.imap_host, port: row.imap_port ?? 993, username: row.imap_username, password: dec(row.imap_password, keyPath), tls: !!row.imap_tls, folder: row.imap_folder ?? "INBOX" });
  await src.connect();
  return { source: src, close: () => src.close() };
}

export async function testSourceById(id: number, dbPath?: string, keyPath?: string): Promise<{ ok: boolean; error?: string; sample?: number }> {
  const row = getSourceRow(id, dbPath);
  if (!row) return { ok: false, error: "Not found" };
  try {
    const { source, close } = await buildSourceClient(row, keyPath);
    try { const n = await source.listInbox(1); return { ok: true, sample: n.length }; }
    finally { await close(); }
  } catch (e: any) { return { ok: false, error: String(e?.message ?? e) }; }
}

// One-time migration of legacy flat single-source settings into the first table row.
export function migrateLegacySource(dbPath?: string, keyPath?: string): void {
  if (countSources(dbPath) > 0) return;
  const provider = getSetting<string>("mailbox_provider", dbPath, keyPath);
  if (provider === "graph") {
    const mailboxUpn = getSetting<string>("mailbox_upn", dbPath, keyPath);
    if (!mailboxUpn) return;
    const domain = mailboxUpn.includes("@") ? mailboxUpn.split("@")[1] : mailboxUpn;
    createSource({ domain, provider: "graph", graph: {
      tenantId: getSetting<string>("graph_tenant_id", dbPath, keyPath),
      clientId: getSetting<string>("graph_client_id", dbPath, keyPath),
      clientSecret: getSetting<string>("graph_client_secret", dbPath, keyPath),
      mailboxUpn,
    } }, dbPath, keyPath);
  } else if (provider === "imap") {
    const username = getSetting<string>("imap_username", dbPath, keyPath);
    const host = getSetting<string>("imap_host", dbPath, keyPath);
    if (!host || !username) return;
    const domain = username.includes("@") ? username.split("@")[1] : host;
    createSource({ domain, provider: "imap", imap: {
      host, port: getSetting<number>("imap_port", dbPath, keyPath) || 993,
      username, password: getSetting<string>("imap_password", dbPath, keyPath),
      tls: getSetting<boolean>("imap_tls", dbPath, keyPath), folder: getSetting<string>("imap_folder", dbPath, keyPath) || "INBOX",
    } }, dbPath, keyPath);
  }
}
