import { getSetting } from "@/lib/settings";
import { buildDigestHtml } from "./digest";
import { sendEmail } from "./mailersend";

const DAY = 86400;

export async function sendDigest(period: "weekly" | "monthly", now: number): Promise<void> {
  const token = getSetting<string>("mailersend_token");
  if (!token) { console.warn("[digest] mailersend_token not set; skipping"); return; }
  const recipients = getSetting<string[]>("digest_recipients");
  if (!recipients.length) { console.warn("[digest] no recipients configured; skipping"); return; }
  const span = period === "weekly" ? 7 * DAY : 30 * DAY;
  const from = now - span;
  const prevWindowStart = now - 2 * span;
  const { subject, html } = buildDigestHtml(undefined, period, { from, to: now }, prevWindowStart);
  await sendEmail({
    token, from: getSetting<string>("mailersend_from"), fromName: "DMARC Dashboard",
    to: recipients, subject, html,
  });
  console.log(`[digest] sent ${period} digest to ${recipients.join(", ")}`);
}
