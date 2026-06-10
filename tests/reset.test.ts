import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { migrate } from "@/lib/db/migrate";
import { closeDb } from "@/lib/db/connection";
import { createUser } from "@/lib/auth/users";
import { createReset, consumeReset } from "@/lib/auth/reset";
import { verifyLogin } from "@/lib/auth/users";

const TMP = "data/test-reset.db";
afterEach(() => { closeDb(); for (const s of ["","-wal","-shm"]) fs.rmSync(TMP+s,{force:true}); });

describe("password reset", () => {
  it("issues a single-use token that resets the password", () => {
    migrate(TMP);
    const u = createUser({ username: "u", email: "u@x.com", password: "oldpass12", role: "viewer" }, TMP);
    const token = createReset(u.id, TMP)!;
    expect(consumeReset(token, "newpass12", TMP)).toBe(true);
    expect(verifyLogin("u", "newpass12", TMP)?.id).toBe(u.id);
    // token cannot be reused
    expect(consumeReset(token, "another12", TMP)).toBe(false);
  });
  it("rejects an unknown token", () => {
    migrate(TMP);
    expect(consumeReset("deadbeef", "newpass12", TMP)).toBe(false);
  });
});
