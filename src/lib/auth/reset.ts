import { getDb } from "@/lib/db/connection";
import { generateResetToken, hashToken } from "./tokens";
import { setPassword } from "./users";

const TTL = 3600; // 1 hour

export function createReset(userId: number, dbPath?: string): string | null {
  const { token, tokenHash } = generateResetToken();
  const now = Math.floor(Date.now() / 1000);
  getDb(dbPath).prepare(
    `INSERT INTO password_reset (user_id,token_hash,expires_at) VALUES (?,?,?)`
  ).run(userId, tokenHash, now + TTL);
  return token;
}

export function consumeReset(token: string, newPassword: string, dbPath?: string): boolean {
  const db = getDb(dbPath);
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare(
    `SELECT * FROM password_reset WHERE token_hash=? AND used_at IS NULL AND expires_at > ?`
  ).get(hashToken(token), now) as any;
  if (!row) return false;
  setPassword(row.user_id, newPassword, dbPath);
  db.prepare(`UPDATE password_reset SET used_at=? WHERE id=?`).run(now, row.id);
  return true;
}
