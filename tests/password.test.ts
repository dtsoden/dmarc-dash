import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("hashes and verifies", () => {
    const h = hashPassword("s3cret");
    expect(verifyPassword("s3cret", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });
});
