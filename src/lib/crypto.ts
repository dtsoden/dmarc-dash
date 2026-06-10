import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function getOrCreateKey(keyPath: string): Buffer {
  if (fs.existsSync(keyPath)) {
    const buf = fs.readFileSync(keyPath);
    if (buf.length === 32) return buf;
    // The file exists but is the wrong size (truncated/corrupted). Overwriting would
    // silently make every stored secret undecryptable, so fail loudly instead.
    throw new Error(`App key at ${keyPath} is corrupt (expected 32 bytes, got ${buf.length}). Restore it from backup or remove it to start fresh.`);
  }
  const key = crypto.randomBytes(32);
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, key, { mode: 0o600 });
  try { fs.chmodSync(keyPath, 0o600); } catch { /* windows */ }
  return key;
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(blob: string, key: Buffer): string {
  const raw = Buffer.from(blob, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
