import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { migrate } from "@/lib/db/migrate";
import { closeDb } from "@/lib/db/connection";
import { createUser, countAdmins } from "@/lib/auth/users";
import { canRemoveAdmin } from "@/lib/auth/users-guard";

const TMP = "data/test-uguard.db";
afterEach(() => { closeDb(); for (const s of ["","-wal","-shm"]) fs.rmSync(TMP+s,{force:true}); });

describe("last-admin protection", () => {
  it("blocks removing/demoting the only admin", () => {
    migrate(TMP);
    const a = createUser({ username: "a", email: "a@x.com", password: "pw123456", role: "admin" }, TMP);
    expect(canRemoveAdmin(a.id, TMP)).toBe(false);
    createUser({ username: "b", email: "b@x.com", password: "pw123456", role: "admin" }, TMP);
    expect(canRemoveAdmin(a.id, TMP)).toBe(true);
    expect(countAdmins(TMP)).toBe(2);
  });
});
