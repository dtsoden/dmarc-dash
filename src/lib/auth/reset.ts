import { getDb } from "@/lib/db/connection";
import { generateResetToken, hashToken } from "./tokens";
import { setPassword } from "./users";

const TTL = 3600; // 1 hour (password reset)
export const INVITE_TTL = 7 * 24 * 3600; // 7 days (new-user set-password invite)

export function createReset(userId: number, dbPath?: string, ttlSeconds: number = TTL): string | null {
  const { token, tokenHash } = generateResetToken();
  const now = Math.floor(Date.now() / 1000);
  getDb(dbPath).prepare(
    `INSERT INTO password_reset (user_id,token_hash,expires_at) VALUES (?,?,?)`
  ).run(userId, tokenHash, now + ttlSeconds);
  return token;
}

export function consumeReset(token: string, newPassword: string, dbPath?: string): boolean {
  const db = getDb(dbPath);
  const now = Math.floor(Date.now() / 1000);
  // Atomic single-use claim: mark the token used in one guarded UPDATE so two concurrent
  // requests can't both pass a SELECT and reuse the same token. Only the request whose
  // UPDATE actually changed a row (changes === 1) gets to set the password.
  const claim = db.transaction((tokenHash: string): number | null => {
    const res = db.prepare(
      `UPDATE password_reset SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at > ?`
    ).run(now, tokenHash, now);
    if (res.changes !== 1) return null;
    const row = db.prepare(`SELECT user_id FROM password_reset WHERE token_hash=?`).get(tokenHash) as { user_id: number };
    setPassword(row.user_id, newPassword, dbPath);
    return row.user_id;
  });
  return claim(hashToken(token)) !== null;
}
