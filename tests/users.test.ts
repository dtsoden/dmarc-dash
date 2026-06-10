import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { migrate } from "@/lib/db/migrate";
import { closeDb } from "@/lib/db/connection";
import { createUser, verifyLogin, listUsers, adminExists, countAdmins, updateUser, setPassword, deleteUser } from "@/lib/auth/users";

const TMP = "data/test-users.db";
afterEach(() => { closeDb(); for (const s of ["","-wal","-shm"]) fs.rmSync(TMP+s,{force:true}); });

describe("users", () => {
  it("creates an admin and logs in by username or email", () => {
    migrate(TMP);
    expect(adminExists(TMP)).toBe(false);
    createUser({ username: "admin", email: "a@x.com", password: "pw123456", role: "admin" }, TMP);
    expect(adminExists(TMP)).toBe(true);
    expect(countAdmins(TMP)).toBe(1);
    expect(verifyLogin("admin", "pw123456", TMP)?.role).toBe("admin");
    expect(verifyLogin("a@x.com", "pw123456", TMP)?.username).toBe("admin");
    expect(verifyLogin("admin", "wrong", TMP)).toBeNull();
  });
  it("rejects login for inactive users", () => {
    migrate(TMP);
    const u = createUser({ username: "v", email: "v@x.com", password: "pw123456", role: "viewer" }, TMP);
    updateUser(u.id, { isActive: false }, TMP);
    expect(verifyLogin("v", "pw123456", TMP)).toBeNull();
  });
  it("sets a new password and lists/deletes users", () => {
    migrate(TMP);
    const u = createUser({ username: "n", email: "n@x.com", password: "pw123456", role: "analyst" }, TMP);
    setPassword(u.id, "newpass123", TMP);
    expect(verifyLogin("n", "newpass123", TMP)?.id).toBe(u.id);
    expect(listUsers(TMP).length).toBe(1);
    deleteUser(u.id, TMP);
    expect(listUsers(TMP).length).toBe(0);
  });
});
