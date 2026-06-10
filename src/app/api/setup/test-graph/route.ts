import { NextResponse } from "next/server";
import { GraphAuth } from "@/lib/graph/auth";
import { GraphClient } from "@/lib/graph/client";

export async function POST(req: Request) {
  const { tenantId, clientId, clientSecret, mailboxUpn } = await req.json();
  try {
    const client = new GraphClient(new GraphAuth({ tenantId, clientId, clientSecret }), mailboxUpn);
    const msgs = await client.listInbox(1);
    return NextResponse.json({ ok: true, sample: msgs.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 200 });
  }
}
