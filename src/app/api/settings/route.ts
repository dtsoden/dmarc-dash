import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import { getSettings, setSettings, SETTING_DEFS } from "@/lib/settings";
import { applySettingsChange } from "@/lib/scheduler";

const MASK = "********";
const SECRET_KEYS = Object.entries(SETTING_DEFS).filter(([, d]) => d.type === "secret").map(([k]) => k);

async function ensureAdmin() {
  const s = await getSession();
  return s.loggedIn && s.role === "admin";
}

export async function GET() {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const all = getSettings();
  // Never send secret values to the browser - send a mask sentinel if a value is set.
  for (const k of SECRET_KEYS) all[k] = all[k] ? MASK : "";
  return NextResponse.json(all);
}

export async function POST(req: Request) {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!(k in SETTING_DEFS) || k === "setup_complete") continue;
    // Skip masked secrets so an unchanged field doesn't overwrite the stored secret.
    if (SECRET_KEYS.includes(k) && (v === MASK || v === "")) continue;
    update[k] = v;
  }
  setSettings(update);
  applySettingsChange();   // live re-schedule poll + digests
  return NextResponse.json({ ok: true });
}
