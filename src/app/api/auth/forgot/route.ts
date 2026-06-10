import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/auth/users";
import { createReset } from "@/lib/auth/reset";
import { getSetting } from "@/lib/settings";
import { sendEmail } from "@/lib/email/mailersend";

export async function POST(req: Request) {
  const { email } = await req.json();
  const token = getSetting<string>("mailersend_token");
  if (!token) return NextResponse.json({ ok: false, emailConfigured: false });
  const user = getUserByEmail(email ?? "");
  if (user && user.isActive) {
    const resetToken = createReset(user.id);
    const base = req.headers.get("origin") ?? "";
    await sendEmail({
      token, from: getSetting<string>("mailersend_from"), fromName: "DMARC Dashboard",
      to: [user.email], subject: "Reset your DMARC Dashboard password",
      html: `<p>Reset your password: <a href="${base}/reset/${resetToken}">${base}/reset/${resetToken}</a></p><p>This link expires in 1 hour.</p>`,
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true, emailConfigured: true });
}
