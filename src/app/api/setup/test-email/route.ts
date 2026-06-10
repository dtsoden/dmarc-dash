import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/mailersend";
import { isWizardOrAdmin } from "@/lib/auth/guard";

export async function POST(req: Request) {
  if (!(await isWizardOrAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { token, from, recipients } = await req.json();
  try {
    await sendEmail({ token, from, fromName: "DMARC Dashboard", to: recipients,
      subject: "DMARC Dashboard test email", html: "<p>Your MailerSend configuration works.</p>" });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 200 });
  }
}
