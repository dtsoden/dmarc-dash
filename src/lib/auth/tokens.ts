import crypto from "node:crypto";
export function generateResetToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
