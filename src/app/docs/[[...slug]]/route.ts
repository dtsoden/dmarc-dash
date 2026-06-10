import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

// The Docusaurus static build is copied here in the Docker image (see Dockerfile).
const DOCS_DIR = path.join(process.cwd(), "docs-build");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".map": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json",
};

function resolveFile(slug: string[]): string | null {
  const rel = slug.join("/");
  const full = path.normalize(path.join(DOCS_DIR, rel));
  if (!full.startsWith(DOCS_DIR)) return null; // path traversal guard
  if (rel === "") return path.join(DOCS_DIR, "index.html");
  try {
    if (fs.existsSync(full)) {
      const stat = fs.statSync(full);
      if (stat.isDirectory()) return path.join(full, "index.html");
      if (stat.isFile()) return full;
    }
    // Clean URLs (trailingSlash): /docs/x -> docs-build/x/index.html
    if (!path.extname(rel)) {
      const idx = path.join(full, "index.html");
      if (fs.existsSync(idx)) return idx;
      if (fs.existsSync(full + ".html")) return full + ".html";
    }
  } catch { /* fall through */ }
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  if (!fs.existsSync(DOCS_DIR)) {
    return new NextResponse("Documentation is not bundled in this build.", { status: 503 });
  }
  const { slug = [] } = await params;
  const file = resolveFile(slug);
  if (!file || !fs.existsSync(file)) return new NextResponse("Not found", { status: 404 });
  const buf = fs.readFileSync(file);
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" },
  });
}
