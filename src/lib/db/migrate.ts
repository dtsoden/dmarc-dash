import fs from "node:fs";
import path from "node:path";
import { getDb } from "./connection";

export function migrate(dbPath?: string) {
  const db = getDb(dbPath);
  const sql = fs.readFileSync(path.join(process.cwd(), "src/lib/db/schema.sql"), "utf8");
  db.exec(sql);
  return db;
}

if (require.main === module) { migrate(); console.log("Migrated."); }
