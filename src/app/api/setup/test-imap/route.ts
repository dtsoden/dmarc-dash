import { NextResponse } from "next/server";
import { testImap } from "@/lib/mailbox/source";
import { isWizardOrAdmin } from "@/lib/auth/guard";

export async function POST(req: Request) {
  if (!(await isWizardOrAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { host, port, username, password, tls, folder } = await req.json();
  try {
    const sample = await testImap({
      host,
      port: Number(port) || 993,
      username,
      password,
      tls: tls !== false,
      folder: folder || "INBOX",
    });
    return NextResponse.json({ ok: true, sample });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 200 });
  }
}
