import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { getOrCreateKey, encryptSecret, decryptSecret } from "@/lib/crypto";

const KEY = "data/test-app.key";
afterEach(() => fs.rmSync(KEY, { force: true }));

describe("crypto", () => {
  it("creates a 32-byte key once and reuses it", () => {
    const k1 = getOrCreateKey(KEY);
    const k2 = getOrCreateKey(KEY);
    expect(k1.length).toBe(32);
    expect(k1.equals(k2)).toBe(true);
  });
  it("round-trips an encrypted secret", () => {
    const key = getOrCreateKey(KEY);
    const blob = encryptSecret("hunter2", key);
    expect(blob).not.toContain("hunter2");
    expect(decryptSecret(blob, key)).toBe("hunter2");
  });
  it("fails to decrypt tampered ciphertext", () => {
    const key = getOrCreateKey(KEY);
    const blob = encryptSecret("x", key);
    expect(() => decryptSecret(blob.slice(0, -2) + "00", key)).toThrow();
  });
});
