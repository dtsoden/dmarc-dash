import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/mailersend";

export async function POST(req: Request) {
  const { token, from, recipients } = await req.json();
  try {
    await sendEmail({ token, from, fromName: "DMARC Dashboard", to: recipients,
      subject: "DMARC Dashboard test email", html: "<p>Your MailerSend configuration works.</p>" });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 200 });
  }
}
