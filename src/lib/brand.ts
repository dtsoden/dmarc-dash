import path from "node:path";
import { bootstrap } from "@/lib/config";
import { getSetting } from "@/lib/settings";

export interface Brand {
  appName: string;
  colorLight: string;  // brand color for light mode
  colorDark: string;   // brand color for dark mode
  defaultTheme: string; // "light" | "dark" admin default
  logoExt: string;     // "" when no custom logo (use wordmark)
  faviconExt: string;  // "" when no custom favicon
}

export function getBrand(): Brand {
  return {
    appName: getSetting<string>("brand_app_name") || "DMARC Dashboard",
    colorLight: getSetting<string>("brand_color_light") || "#0093a2",
    colorDark: getSetting<string>("brand_color_dark") || "#00df7e",
    defaultTheme: getSetting<string>("brand_default_theme") === "light" ? "light" : "dark",
    logoExt: getSetting<string>("brand_logo_ext") || "",
    faviconExt: getSetting<string>("brand_favicon_ext") || "",
  };
}

// Readable text color (near-black or white) for a given background hex, by luminance.
export function readableText(hex: string): string {
  const h = (hex || "").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6) return "#ffffff";
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? "#0b1a14" : "#ffffff";
}

export function brandDir(): string {
  return path.join(bootstrap().dataDir, "brand");
}
export function brandFilePath(kind: "logo" | "favicon", ext: string): string {
  return path.join(brandDir(), `${kind}.${ext}`);
}

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
