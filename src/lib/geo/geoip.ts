import maxmind, { type CityResponse, type Reader } from "maxmind";
import fs from "node:fs";
import { bootstrap } from "@/lib/config";

let reader: Reader<CityResponse> | null = null;
let attempted = false;

async function getReader(): Promise<Reader<CityResponse> | null> {
  if (attempted) return reader;
  attempted = true;
  const p = bootstrap().geoPath;
  if (!fs.existsSync(p)) return null;
  reader = await maxmind.open<CityResponse>(p);
  return reader;
}

export async function locate(ip: string): Promise<{ lat: number; lon: number; country?: string } | null> {
  const r = await getReader();
  if (!r) return null;
  try {
    const res = r.get(ip);
    if (!res?.location) return null;
    return { lat: res.location.latitude, lon: res.location.longitude, country: res.country?.iso_code };
  } catch { return null; }
}
