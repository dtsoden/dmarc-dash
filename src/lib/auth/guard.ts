import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData, type Role } from "./session";
import { adminExists } from "./users";
import { getSetting } from "@/lib/settings";

export async function getSession(): Promise<SessionData> {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

export function isSetupComplete(): boolean {
  return getSetting<boolean>("setup_complete") && adminExists();
}

export async function requireSetupComplete() {
  if (!isSetupComplete()) redirect("/setup");
}

export async function requireUser(): Promise<SessionData> {
  const s = await getSession();
  if (!s.loggedIn) redirect("/login");
  return s;
}

export async function requireRole(...roles: Role[]): Promise<SessionData> {
  const s = await requireUser();
  if (!s.role || !roles.includes(s.role)) redirect("/");
  return s;
}
