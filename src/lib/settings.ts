import { getDb } from "@/lib/db/connection";
import { bootstrap } from "@/lib/config";
import { getOrCreateKey, encryptSecret, decryptSecret } from "@/lib/crypto";

type SettingType = "string" | "int" | "bool" | "secret" | "json";
interface Def { type: SettingType; default: unknown }

export const SETTING_DEFS: Record<string, Def> = {
  setup_complete:        { type: "bool",   default: false },
  // Mailbox source: "" (none) | "graph" | "imap". Mutually exclusive.
  mailbox_provider:      { type: "string", default: "" },
  // Microsoft Graph (365)
  graph_tenant_id:       { type: "string", default: "" },
  graph_client_id:       { type: "string", default: "" },
  graph_client_secret:   { type: "secret", default: "" },
  mailbox_upn:           { type: "string", default: "" },
  // IMAP (Gmail/Workspace, Fastmail, generic) - basic auth / app password
  imap_host:             { type: "string", default: "" },
  imap_port:             { type: "int",    default: 993 },
  imap_username:         { type: "string", default: "" },
  imap_password:         { type: "secret", default: "" },
  imap_tls:              { type: "bool",   default: true },
  imap_folder:           { type: "string", default: "INBOX" },
  poll_interval_minutes: { type: "int",    default: 15 },
  delete_mode:           { type: "string", default: "safe" },
  mailersend_token:      { type: "secret", default: "" },
  mailersend_from:       { type: "string", default: "dmarc@beaconspec.com" },
  digest_recipients:     { type: "json",   default: ["david.soden@beaconspec.com", "duane.walker@beaconspec.com"] },
  digest_weekly_cron:    { type: "string", default: "0 8 * * 1" },
  digest_monthly_cron:   { type: "string", default: "0 8 1 * *" },
  maxmind_license_key:   { type: "secret", default: "" },
  // White-label / branding. One brand color per UI mode (drives buttons, active tabs,
  // links, focus ring, and the logo mark). Text contrast is auto-computed.
  brand_app_name:        { type: "string", default: "DMARC Dashboard" },
  brand_color_light:     { type: "string", default: "#0093a2" },
  brand_color_dark:      { type: "string", default: "#00df7e" },
  brand_logo_ext:        { type: "string", default: "" },   // e.g. "svg"/"png"; "" => wordmark
  brand_favicon_ext:     { type: "string", default: "" },   // e.g. "svg"/"ico"/"png"
};

function key(keyPath?: string) { return getOrCreateKey(keyPath ?? bootstrap().keyPath); }

function decode(type: SettingType, raw: string, keyPath?: string): unknown {
  switch (type) {
    case "int": return Number(raw);
    case "bool": return raw === "true" || raw === "1";
    case "json": return JSON.parse(raw);
    case "secret": return raw ? decryptSecret(raw, key(keyPath)) : "";
    default: return raw;
  }
}
function encode(type: SettingType, value: unknown, keyPath?: string): string {
  switch (type) {
    case "int": return String(Math.trunc(Number(value)));
    case "bool": return value ? "true" : "false";
    case "json": return JSON.stringify(value);
    case "secret": return value ? encryptSecret(String(value), key(keyPath)) : "";
    default: return String(value ?? "");
  }
}

export function getSetting<T = unknown>(k: string, dbPath?: string, keyPath?: string): T {
  const def = SETTING_DEFS[k];
  if (!def) throw new Error(`Unknown setting: ${k}`);
  const row = getDb(dbPath).prepare("SELECT value FROM setting WHERE key=?").get(k) as { value: string } | undefined;
  if (!row || row.value === null || row.value === "") {
    return (def.type === "secret" ? "" : def.default) as T;
  }
  return decode(def.type, row.value, keyPath) as T;
}

export function setSetting(k: string, value: unknown, dbPath?: string, keyPath?: string): void {
  const def = SETTING_DEFS[k];
  if (!def) throw new Error(`Unknown setting: ${k}`);
  getDb(dbPath).prepare(
    `INSERT INTO setting (key,value,type,updated_at) VALUES (?,?,?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, type=excluded.type, updated_at=excluded.updated_at`
  ).run(k, encode(def.type, value, keyPath), def.type, Math.floor(Date.now() / 1000));
}

export function setSettings(values: Record<string, unknown>, dbPath?: string, keyPath?: string): void {
  for (const [k, v] of Object.entries(values)) if (k in SETTING_DEFS) setSetting(k, v, dbPath, keyPath);
}

export function getSettings(dbPath?: string, keyPath?: string): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(SETTING_DEFS)) out[k] = getSetting(k, dbPath, keyPath);
  return out;
}
