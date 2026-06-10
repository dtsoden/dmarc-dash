import { NextResponse } from "next/server";
import { GraphAuth } from "@/lib/graph/auth";
import { GraphClient } from "@/lib/graph/client";
import { isWizardOrAdmin } from "@/lib/auth/guard";

export async function POST(req: Request) {
  if (!(await isWizardOrAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId, clientId, clientSecret, mailboxUpn } = await req.json();
  try {
    const client = new GraphClient(new GraphAuth({ tenantId, clientId, clientSecret }), mailboxUpn);
    const msgs = await client.listInbox(1);
    return NextResponse.json({ ok: true, sample: msgs.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 200 });
  }
}
