import { NextResponse } from "next/server";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import { isSetupComplete } from "@/lib/auth/guard";
import { createUser } from "@/lib/auth/users";
import { setSettings, setSetting } from "@/lib/settings";
import { createSource } from "@/lib/mailbox/store";
import { applySettingsChange } from "@/lib/scheduler";
import { downloadGeoLite } from "@/lib/geo/fetch-geolite";

const DOMAIN_RE = /^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/i;

const Body = z.object({
  admin: z.object({ username: z.string().min(1), email: z.string().email(), password: z.string().min(8) }),
  source: z.object({
    domain: z.string().regex(DOMAIN_RE, "Enter a valid domain name, e.g. example.com."),
    provider: z.enum(["graph", "imap"]),
    graph: z.object({ tenantId: z.string().min(1), clientId: z.string().min(1), clientSecret: z.string().min(1), mailboxUpn: z.string().email() }).optional(),
    imap: z.object({
      host: z.string().min(1), port: z.number().int().min(1).max(65535).optional(),
      username: z.string().min(1), password: z.string().min(1),
      tls: z.boolean().optional(), folder: z.string().optional(),
    }).optional(),
  }).superRefine((s, ctx) => {
    if (s.provider === "graph" && !s.graph) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["graph"], message: "Microsoft 365 configuration is required." });
    if (s.provider === "imap" && !s.imap) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["imap"], message: "IMAP configuration is required." });
  }),
  poll: z.object({ intervalMinutes: z.number().int().min(1).max(1440), deleteMode: z.enum(["safe", "hard"]) }),
  email: z.object({ token: z.string(), from: z.string(), recipients: z.array(z.string()), weeklyCron: z.string(), monthlyCron: z.string() }).optional(),
  maxmind: z.object({ key: z.string() }).optional(),
  brand: z.object({ appName: z.string(), colorLight: z.string(), colorDark: z.string(), defaultTheme: z.enum(["light", "dark"]) }).optional(),
});

export async function POST(req: Request) {
  if (isSetupComplete()) return NextResponse.json({ error: "Setup already complete" }, { status: 403 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const b = parsed.data;

  const admin = createUser({ username: b.admin.username, email: b.admin.email, password: b.admin.password, role: "admin" });

  // First monitored domain as a mailbox source.
  const s = b.source;
  createSource({
    domain: s.domain,
    provider: s.provider,
    graph: s.graph,
    imap: s.imap ? { host: s.imap.host, port: s.imap.port ?? 993, username: s.imap.username, password: s.imap.password, tls: s.imap.tls ?? true, folder: s.imap.folder || "INBOX" } : undefined,
  });

  setSettings({ poll_interval_minutes: b.poll.intervalMinutes, delete_mode: b.poll.deleteMode });
  if (b.email) setSettings({
    mailersend_token: b.email.token, mailersend_from: b.email.from,
    digest_recipients: b.email.recipients, digest_weekly_cron: b.email.weeklyCron, digest_monthly_cron: b.email.monthlyCron,
  });
  if (b.maxmind) { setSetting("maxmind_license_key", b.maxmind.key); void downloadGeoLite(b.maxmind.key); }
  if (b.brand) setSettings({
    brand_app_name: b.brand.appName, brand_color_light: b.brand.colorLight,
    brand_color_dark: b.brand.colorDark, brand_default_theme: b.brand.defaultTheme,
  });
  setSetting("setup_complete", true);
  applySettingsChange();

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions());
  session.userId = admin.id; session.username = admin.username; session.role = "admin"; session.loggedIn = true;
  await session.save();
  return NextResponse.json({ ok: true });
}
