import cron, { type ScheduledTask } from "node-cron";
import { migrate } from "@/lib/db/migrate";
import { getSetting } from "@/lib/settings";
import { GraphAuth } from "@/lib/graph/auth";
import { GraphClient } from "@/lib/graph/client";
import { processMailbox } from "@/lib/graph/mailbox";
import { sendDigest } from "@/lib/email/send-digest";

let pollTask: ScheduledTask | null = null;
let weeklyTask: ScheduledTask | null = null;
let monthlyTask: ScheduledTask | null = null;
let started = false;
let running = false;

// Poll interval is stored in MINUTES; convert to a cron expression.
function minutesToCron(min: number): string {
  const m = Math.max(1, Math.trunc(min));
  if (m < 60) return `*/${m} * * * *`;
  const hours = Math.max(1, Math.trunc(m / 60));
  return `0 */${hours} * * *`;
}

export async function runPollOnce() {
  if (running) { console.log("[poll] previous run still in progress, skipping"); return { skipped: true }; }
  running = true;
  try {
    const tenantId = getSetting<string>("graph_tenant_id");
    const clientId = getSetting<string>("graph_client_id");
    const clientSecret = getSetting<string>("graph_client_secret");
    const mailbox = getSetting<string>("mailbox_upn");
    if (!tenantId || !clientId || !clientSecret || !mailbox) {
      console.log("[poll] Graph not configured yet; skipping");
      return { skipped: true };
    }
    const auth = new GraphAuth({ tenantId, clientId, clientSecret });
    const client = new GraphClient(auth, mailbox);
    const deleteMode = getSetting<"safe" | "hard">("delete_mode");
    const res = await processMailbox(client, { deleteMode });
    console.log(`[poll] ${new Date().toISOString()}`, res);
    return res;
  } catch (e) {
    console.error("[poll] error:", e);
    return { error: String((e as any)?.message ?? e) };
  } finally {
    running = false;
  }
}

// (Re)schedule the poll job from the current settings. Safe to call repeatedly —
// call it after the wizard finishes or whenever the interval setting changes.
export function reschedulePoll() {
  pollTask?.stop();
  if (!getSetting<boolean>("setup_complete")) {
    console.log("[scheduler] setup not complete; poll disabled");
    return;
  }
  const expr = minutesToCron(getSetting<number>("poll_interval_minutes"));
  pollTask = cron.schedule(expr, () => { void runPollOnce(); });
  console.log(`[scheduler] poll scheduled "${expr}"`);
}

// (Re)schedule digests from settings (body filled in Task D.4).
export function rescheduleDigests() {
  weeklyTask?.stop(); monthlyTask?.stop();
  weeklyTask = null; monthlyTask = null;
  if (!getSetting<boolean>("setup_complete")) return;
  if (!getSetting<string>("mailersend_token")) {
    console.log("[scheduler] mailersend_token not set; digests disabled");
    return;
  }
  const weekly = getSetting<string>("digest_weekly_cron");
  const monthly = getSetting<string>("digest_monthly_cron");
  if (cron.validate(weekly))
    weeklyTask = cron.schedule(weekly, () => { void sendDigest("weekly", Math.floor(Date.now() / 1000)); });
  if (cron.validate(monthly))
    monthlyTask = cron.schedule(monthly, () => { void sendDigest("monthly", Math.floor(Date.now() / 1000)); });
  console.log(`[scheduler] digests scheduled (weekly "${weekly}", monthly "${monthly}")`);
}

// Re-apply both schedules after settings change (wizard finish, Settings save).
export function applySettingsChange() { reschedulePoll(); rescheduleDigests(); }

export function startScheduler() {
  if (started) return;
  started = true;
  migrate();
  reschedulePoll();
  rescheduleDigests();
  console.log("[scheduler] started");
}
