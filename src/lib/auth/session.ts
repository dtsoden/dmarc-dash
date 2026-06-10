import type { SessionOptions } from "iron-session";
import { getOrCreateKey } from "@/lib/crypto";
import { bootstrap } from "@/lib/config";

export type Role = "admin" | "analyst" | "viewer";
export interface SessionData {
  userId?: number;
  username?: string;
  role?: Role;
  loggedIn: boolean;
  mustChangePassword?: boolean;
}

export function sessionOptions(): SessionOptions {
  // 64-hex-char secret from the app key file (>= 32 chars required by iron-session).
  const secret = getOrCreateKey(bootstrap().keyPath).toString("hex");
  return {
    password: secret,
    cookieName: "dmarc_session",
    cookieOptions: { secure: process.env.NODE_ENV === "production", httpOnly: true, sameSite: "lax" },
  };
}
