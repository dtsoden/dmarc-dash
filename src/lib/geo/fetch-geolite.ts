import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { Readable } from "node:stream";
import { extract } from "tar-stream";
import { bootstrap } from "@/lib/config";
import { resetGeoReader } from "./geoip";

let inProgress = false;

// Download the MaxMind GeoLite2-City database into the data volume and refresh the
// in-memory reader. Safe to call fire-and-forget after a key is saved.
export async function downloadGeoLite(licenseKey: string, geoPath = bootstrap().geoPath): Promise<void> {
  if (!licenseKey) return;
  if (inProgress) return;
  inProgress = true;
  try {
    const url = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${encodeURIComponent(licenseKey)}&suffix=tar.gz`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`MaxMind download failed: ${res.status}`);
    const tarBuf = zlib.gunzipSync(Buffer.from(await res.arrayBuffer()));
    await new Promise<void>((resolve, reject) => {
      const ex = extract();
      ex.on("entry", (header, stream, next) => {
        if (header.name.endsWith(".mmdb")) {
          fs.mkdirSync(path.dirname(geoPath), { recursive: true });
          stream.pipe(fs.createWriteStream(geoPath)).on("finish", next).on("error", reject);
        } else { stream.on("end", next); stream.resume(); }
      });
      ex.on("finish", resolve);
      ex.on("error", reject);
      Readable.from(tarBuf).pipe(ex);
    });
    resetGeoReader();
    console.log("[geo] GeoLite2-City database downloaded to", geoPath);
  } catch (e) {
    console.error("[geo] GeoLite2 download failed:", e);
  } finally {
    inProgress = false;
  }
}
