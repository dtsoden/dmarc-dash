import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { Readable } from "node:stream";
import { extract } from "tar-stream";
import { migrate } from "@/lib/db/migrate";
import { getSetting } from "@/lib/settings";
import { bootstrap } from "@/lib/config";

migrate();
const key = getSetting<string>("maxmind_license_key") || process.env.MAXMIND_LICENSE_KEY;
if (!key) { console.error("Set the MaxMind key in the Setup Wizard/Settings, or MAXMIND_LICENSE_KEY env."); process.exit(1); }
const url = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${key}&suffix=tar.gz`;
const outPath = bootstrap().geoPath;

(async () => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MaxMind download failed: ${res.status}`);
  const gz = Buffer.from(await res.arrayBuffer());
  const tarBuf = zlib.gunzipSync(gz);
  const ex = extract();
  ex.on("entry", (header, stream, next) => {
    if (header.name.endsWith(".mmdb")) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      stream.pipe(fs.createWriteStream(outPath)).on("finish", next);
    } else { stream.on("end", next); stream.resume(); }
  });
  ex.on("finish", () => console.log("GeoLite2 saved to", outPath));
  Readable.from(tarBuf).pipe(ex);
})().catch((e) => { console.error(e); process.exit(1); });
