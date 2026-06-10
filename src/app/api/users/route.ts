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
  const { username, email, role } = await req.json();
  if (!username || !email || !["admin", "analyst", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Username, a valid email, and a role are required" }, { status: 400 });
  }

  // Adding users requires outbound email: the new user is invited via a token link and
  // never receives a password. Without email configured we refuse rather than email a secret.
  const msToken = getSetting<string>("mailersend_token");
  if (!msToken) {
    return NextResponse.json({ error: "Configure email under Settings -> Notifications before adding users." }, { status: 400 });
  }

  // Create with an unusable random password; the user sets their own via the invite link.
  const initial = crypto.randomBytes(18).toString("base64url");
  let user;
  try {
    user = createUser({ username, email, password: initial, role, mustChangePassword: true });
  } catch {
    return NextResponse.json({ error: "Username or email already exists" }, { status: 409 });
  }

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
