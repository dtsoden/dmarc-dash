import type { NextConfig } from "next";
import path from "node:path";
const nextConfig: NextConfig = {
  output: "standalone",
  // The bundled Docusaurus docs use trailing-slash URLs; let our /docs catch-all serve
  // them directly instead of Next 308-redirecting every doc deep-link.
  skipTrailingSlashRedirect: true,
  // Pin the tracing root to this project so standalone output is always flat
  // (.next/standalone/server.js), even when a stray parent package.json exists on the
  // host. This keeps the Docker CMD ["node", "server.js"] correct in all cases.
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["better-sqlite3"],
};
export default nextConfig;
