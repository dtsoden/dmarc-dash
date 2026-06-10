import { NextResponse } from "next/server";
import { isWizardOrAdmin } from "@/lib/auth/guard";
import { testSourceById } from "@/lib/mailbox/store";
import { testGraph, testImap } from "@/lib/mailbox/source";

// Test a mailbox connection. With { id } it tests a saved source using stored credentials;
// otherwise it tests the provided (unsaved) credentials. Usable during the wizard.
export async function POST(req: Request) {
  if (!(await isWizardOrAdmin())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const b = await req.json();
  if (b.id) return NextResponse.json(await testSourceById(Number(b.id)));
  try {
    const sample = b.provider === "graph"
      ? await testGraph({ tenantId: b.graph.tenantId, clientId: b.graph.clientId, clientSecret: b.graph.clientSecret, mailboxUpn: b.graph.mailboxUpn })
      : await testImap({ host: b.imap.host, port: Number(b.imap.port) || 993, username: b.imap.username, password: b.imap.password, tls: !!b.imap.tls, folder: b.imap.folder || "INBOX" });
    return NextResponse.json({ ok: true, sample });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 200 });
  }
}
