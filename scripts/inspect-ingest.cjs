const D = require("better-sqlite3");
const db = new D("data/dmarc.db", { readonly: true });

const rows = db.prepare(
  "SELECT filename, reporter, status, message_id, processed_at FROM ingest_log ORDER BY processed_at DESC"
).all();

console.log("Total emails-with-attachments the tool touched:", rows.length);
console.log("(Emails with NO attachment are moved to DMARC-Errors but not listed here.)\n");
for (const r of rows) {
  const when = new Date(r.processed_at * 1000).toISOString().replace("T", " ").slice(0, 19);
  // status 'ingested' => email was DELETED (soft, to Deleted Items)
  // status 'failed'/'duplicate' => email was MOVED to DMARC-Errors (safe mode)
  const fate = r.status === "ingested" ? "DELETED -> Deleted Items" : "MOVED -> DMARC-Errors";
  console.log(`[${when}] ${r.status.padEnd(9)} ${fate.padEnd(26)} file=${r.filename}`);
}

const reps = db.prepare("SELECT org_name, report_id, datetime(date_begin,'unixepoch') b FROM report").all();
console.log("\nReports actually ingested into the DB:", reps.length);
for (const r of reps) console.log("  -", JSON.stringify(r));
