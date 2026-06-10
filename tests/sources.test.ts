import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { migrate } from "@/lib/db/migrate";
import { closeDb } from "@/lib/db/connection";
import {
  createSource, listSourcesSafe, getSourceRow, updateSource,
  validateSourceInput, migrateLegacySource, countSources,
} from "@/lib/mailbox/store";
import { setSetting } from "@/lib/settings";
import { getOrCreateKey, decryptSecret } from "@/lib/crypto";

const TMP = "data/test-sources.db";
const KEY = "data/test-sources.key";
afterEach(() => { closeDb(); for (const s of ["", "-wal", "-shm"]) fs.rmSync(TMP + s, { force: true }); fs.rmSync(KEY, { force: true }); });

describe("mailbox source store", () => {
  it("creates a graph source with an encrypted secret and lowercased domain", () => {
    migrate(TMP);
    const id = createSource({ domain: "Example.COM", provider: "graph", graph: { tenantId: "t", clientId: "c", clientSecret: "shh", mailboxUpn: "dmarc@example.com" } }, TMP, KEY);
    const safe = listSourcesSafe(TMP);
    expect(safe).toHaveLength(1);
    expect(safe[0].domain).toBe("example.com");
    expect(safe[0].hasGraphSecret).toBe(true);
    const raw = getSourceRow(id, TMP).graph_client_secret as string;
    expect(raw).not.toContain("shh");
    expect(decryptSecret(raw, getOrCreateKey(KEY))).toBe("shh");
  });

  it("keeps the stored secret when an update sends a blank one", () => {
    migrate(TMP);
    const id = createSource({ domain: "a.com", provider: "graph", graph: { tenantId: "t", clientId: "c", clientSecret: "sec1", mailboxUpn: "d@a.com" } }, TMP, KEY);
    updateSource(id, { domain: "a.com", provider: "graph", graph: { tenantId: "t2", clientId: "c2", clientSecret: "", mailboxUpn: "d@a.com" } }, TMP, KEY);
    const row = getSourceRow(id, TMP);
    expect(row.graph_tenant_id).toBe("t2");
    expect(decryptSecret(row.graph_client_secret, getOrCreateKey(KEY))).toBe("sec1");
  });

  it("validates domain and required fields", () => {
    expect(validateSourceInput({ domain: "not a domain", provider: "graph", graph: {} })).toMatch(/domain/i);
    expect(validateSourceInput({ domain: "x.com", provider: "graph", graph: { tenantId: "t", clientId: "c", clientSecret: "s", mailboxUpn: "a@x.com" } })).toBeNull();
    expect(validateSourceInput({ domain: "x.com", provider: "imap", imap: { host: "h", username: "u", password: "" } })).toMatch(/imap/i);
    // requireSecrets=false (editing) allows a blank password
    expect(validateSourceInput({ domain: "x.com", provider: "imap", imap: { host: "h", username: "u", password: "" } }, false)).toBeNull();
  });

  it("migrates legacy flat settings into a source row (idempotently)", () => {
    migrate(TMP);
    setSetting("mailbox_provider", "graph", TMP, KEY);
    setSetting("mailbox_upn", "dmarc@beaconspec.com", TMP, KEY);
    setSetting("graph_tenant_id", "t", TMP, KEY);
    setSetting("graph_client_id", "c", TMP, KEY);
    setSetting("graph_client_secret", "s", TMP, KEY);
    migrateLegacySource(TMP, KEY);
    expect(countSources(TMP)).toBe(1);
    expect(listSourcesSafe(TMP)[0].domain).toBe("beaconspec.com");
    migrateLegacySource(TMP, KEY);
    expect(countSources(TMP)).toBe(1);
  });
});
