import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSession } from "@/lib/auth/guard";
import { listUsers, createUser } from "@/lib/auth/users";
import { createReset, INVITE_TTL } from "@/lib/auth/reset";
import { getSetting } from "@/lib/settings";
import { sendEmail } from "@/lib/email/mailersend";
import { getBrand } from "@/lib/brand";

async function ensureAdmin() { const s = await getSession(); return s.loggedIn && s.role === "admin"; }

export async function GET() {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(listUsers());
}

export async function POST(req: Request) {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { username, email, role, password } = await req.json();
  if (!username || !email || !["admin", "analyst", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Username, a valid email, and a role are required" }, { status: 400 });
  }
  // If an admin typed a password it must be valid; otherwise we generate an unusable one
  // and the new user sets their own via the emailed token link (never email a password).
  if (password && password.length < 8) return NextResponse.json({ error: "Password too short (min 8)" }, { status: 400 });
  const initial = password || crypto.randomBytes(18).toString("base64url");

  let user;
  try {
    user = createUser({ username, email, password: initial, role, mustChangePassword: true });
  } catch {
    return NextResponse.json({ error: "Username or email already exists" }, { status: 409 });
  }

  const msToken = getSetting<string>("mailersend_token");
  if (msToken) {
    // Token-based invite: single-use, 7-day link to set their own password.
    const token = createReset(user.id, undefined, INVITE_TTL);
    const base = req.headers.get("origin") ?? "";
    const appName = getBrand().appName;
    const link = `${base}/reset/${token}`;
    await sendEmail({
      token: msToken,
      from: getSetting<string>("mailersend_from"),
      fromName: appName,
      to: [email],
      subject: `You've been invited to ${appName}`,
      html: `<p>An administrator created a ${role} account for you on <strong>${appName}</strong>.</p>
             <p>Set your password to activate it (link valid for 7 days):</p>
             <p><a href="${link}">${link}</a></p>
             <p>Your username is <strong>${username}</strong>.</p>`,
    }).catch(() => {});
    return NextResponse.json({ ...user, invited: true });
  }

  // No email configured: hand the admin a temporary password to relay manually (only when
  // they didn't set one themselves).
  return NextResponse.json({ ...user, invited: false, tempPassword: password ? undefined : initial });
}
