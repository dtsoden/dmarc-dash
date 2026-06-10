import { getDb } from "@/lib/db/connection";
import { hashPassword, verifyPassword } from "./password";
import type { Role } from "./session";

export interface AppUser {
  id: number; username: string; email: string; role: Role;
  isActive: boolean; mustChangePassword: boolean; lastLoginAt: number | null;
}

function mapUser(r: any): AppUser {
  return { id: r.id, username: r.username, email: r.email, role: r.role,
    isActive: !!r.is_active, mustChangePassword: !!r.must_change_password,
    lastLoginAt: r.last_login_at ?? null };
}

export function createUser(
  p: { username: string; email: string; password: string; role: Role; mustChangePassword?: boolean },
  dbPath?: string,
): AppUser {
  const id = getDb(dbPath).prepare(
    `INSERT INTO app_user (username,email,password_hash,role,is_active,must_change_password,created_at)
     VALUES (?,?,?,?,1,?,?)`
  ).run(p.username, p.email.toLowerCase(), hashPassword(p.password), p.role,
    p.mustChangePassword ? 1 : 0, Math.floor(Date.now() / 1000)).lastInsertRowid as number;
  return getUserById(id, dbPath)!;
}

export function getUserById(id: number, dbPath?: string): AppUser | null {
  const r = getDb(dbPath).prepare(`SELECT * FROM app_user WHERE id=?`).get(id);
  return r ? mapUser(r) : null;
}

export function getUserByLogin(login: string, dbPath?: string): any {
  return getDb(dbPath).prepare(
    `SELECT * FROM app_user WHERE username=? OR email=?`
  ).get(login, login.toLowerCase());
}

export function getUserByEmail(email: string, dbPath?: string): AppUser | null {
  const r = getDb(dbPath).prepare(`SELECT * FROM app_user WHERE email=?`).get(email.toLowerCase());
  return r ? mapUser(r) : null;
}

export function verifyLogin(login: string, password: string, dbPath?: string): AppUser | null {
  const r = getUserByLogin(login, dbPath);
  if (!r || !r.is_active) return null;
  if (!verifyPassword(password, r.password_hash)) return null;
  getDb(dbPath).prepare(`UPDATE app_user SET last_login_at=? WHERE id=?`).run(Math.floor(Date.now() / 1000), r.id);
  return mapUser(r);
}

export function listUsers(dbPath?: string): AppUser[] {
  return (getDb(dbPath).prepare(`SELECT * FROM app_user ORDER BY username`).all() as any[]).map(mapUser);
}

export function updateUser(id: number, p: { role?: Role; isActive?: boolean; email?: string }, dbPath?: string): void {
  const cur = getDb(dbPath).prepare(`SELECT * FROM app_user WHERE id=?`).get(id) as any;
  if (!cur) return;
  getDb(dbPath).prepare(`UPDATE app_user SET role=?, is_active=?, email=? WHERE id=?`).run(
    p.role ?? cur.role,
    p.isActive === undefined ? cur.is_active : (p.isActive ? 1 : 0),
    (p.email ?? cur.email).toLowerCase(), id);
}

export function setPassword(id: number, newPassword: string, dbPath?: string): void {
  getDb(dbPath).prepare(`UPDATE app_user SET password_hash=?, must_change_password=0 WHERE id=?`)
    .run(hashPassword(newPassword), id);
}

export function deleteUser(id: number, dbPath?: string): void {
  getDb(dbPath).prepare(`DELETE FROM app_user WHERE id=?`).run(id);
}

export function adminExists(dbPath?: string): boolean { return countAdmins(dbPath) > 0; }
export function countAdmins(dbPath?: string): number {
  return (getDb(dbPath).prepare(`SELECT COUNT(*) c FROM app_user WHERE role='admin' AND is_active=1`).get() as any).c;
}
