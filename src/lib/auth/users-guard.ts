import { getUserById, countAdmins } from "./users";

// True if this user can be demoted/deactivated/deleted without losing the last admin.
export function canRemoveAdmin(userId: number, dbPath?: string): boolean {
  const u = getUserById(userId, dbPath);
  if (!u || u.role !== "admin") return true;
  return countAdmins(dbPath) > 1;
}
