import "dotenv/config";
import { migrate } from "@/lib/db/migrate";
import { sendDigest } from "@/lib/email/send-digest";

const period = (process.argv[2] as "weekly" | "monthly") ?? "weekly";
(async () => {
  migrate();
  await sendDigest(period, Math.floor(Date.now() / 1000));
})().catch((e) => { console.error(e); process.exit(1); });
