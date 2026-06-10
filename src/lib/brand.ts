import path from "node:path";
import { bootstrap } from "@/lib/config";
import { getSetting } from "@/lib/settings";

export interface Brand {
  appName: string;
  primary: string;
  accent: string;
  logoExt: string;     // "" when no custom logo (use wordmark)
  faviconExt: string;  // "" when no custom favicon
}

export function getBrand(): Brand {
  return {
    appName: getSetting<string>("brand_app_name") || "DMARC Dashboard",
    primary: getSetting<string>("brand_primary") || "#0093a2",
    accent: getSetting<string>("brand_accent") || "#00df7e",
    logoExt: getSetting<string>("brand_logo_ext") || "",
    faviconExt: getSetting<string>("brand_favicon_ext") || "",
  };
}

export function brandDir(): string {
  return path.join(bootstrap().dataDir, "brand");
}
export function brandFilePath(kind: "logo" | "favicon", ext: string): string {
  return path.join(brandDir(), `${kind}.${ext}`);
}

// Hex (#rgb or #rrggbb) validation for the color pickers.
export function isHexColor(v: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
}

const MIME_BY_EXT: Record<string, string> = {
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", ico: "image/x-icon", gif: "image/gif",
};
export function mimeForExt(ext: string): string {
  return MIME_BY_EXT[ext.toLowerCase()] ?? "application/octet-stream";
}
export function extFromName(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}
