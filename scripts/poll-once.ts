import "dotenv/config";
import { migrate } from "@/lib/db/migrate";
import { runPollOnce } from "@/lib/scheduler";

(async () => {
  migrate();
  const result = await runPollOnce();   // reads Graph creds + delete_mode from settings
  console.log("Poll result:", result);
})().catch((e) => { console.error(e); process.exit(1); });
