import { NextResponse } from "next/server";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import { isSetupComplete } from "@/lib/auth/guard";
import { createUser } from "@/lib/auth/users";
import { setSettings, setSetting } from "@/lib/settings";
import { applySettingsChange } from "@/lib/scheduler";

const Body = z.object({
  admin: z.object({ username: z.string().min(1), email: z.string().email(), password: z.string().min(8) }),
  graph: z.object({ tenantId: z.string().min(1), clientId: z.string().min(1), clientSecret: z.string().min(1), mailboxUpn: z.string().email() }),
  poll: z.object({ intervalMinutes: z.number().int().min(1).max(1440), deleteMode: z.enum(["safe", "hard"]) }),
  email: z.object({ token: z.string(), from: z.string(), recipients: z.array(z.string()), weeklyCron: z.string(), monthlyCron: z.string() }).optional(),
  maxmind: z.object({ key: z.string() }).optional(),
});

export async function POST(req: Request) {
  if (isSetupComplete()) return NextResponse.json({ error: "Setup already complete" }, { status: 403 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const b = parsed.data;

  const admin = createUser({ username: b.admin.username, email: b.admin.email, password: b.admin.password, role: "admin" });
  setSettings({
    graph_tenant_id: b.graph.tenantId, graph_client_id: b.graph.clientId,
    graph_client_secret: b.graph.clientSecret, mailbox_upn: b.graph.mailboxUpn,
    poll_interval_minutes: b.poll.intervalMinutes, delete_mode: b.poll.deleteMode,
  });
  if (b.email) setSettings({
    mailersend_token: b.email.token, mailersend_from: b.email.from,
    digest_recipients: b.email.recipients, digest_weekly_cron: b.email.weeklyCron, digest_monthly_cron: b.email.monthlyCron,
  });
  if (b.maxmind) setSetting("maxmind_license_key", b.maxmind.key);
  setSetting("setup_complete", true);
  applySettingsChange();

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions());
  session.userId = admin.id; session.username = admin.username; session.role = "admin"; session.loggedIn = true;
  await session.save();
  return NextResponse.json({ ok: true });
}
