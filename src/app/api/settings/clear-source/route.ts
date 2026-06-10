import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import { setSettings } from "@/lib/settings";
import { applySettingsChange } from "@/lib/scheduler";

export async function POST() {
  const s = await getSession();
  if (!(s.loggedIn && s.role === "admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  setSettings({
    mailbox_provider: "",
    graph_tenant_id: "", graph_client_id: "", graph_client_secret: "", mailbox_upn: "",
    imap_host: "", imap_username: "", imap_password: "",
  });
  applySettingsChange();
  return NextResponse.json({ ok: true });
}
