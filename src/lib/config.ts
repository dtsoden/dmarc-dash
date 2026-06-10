import path from "node:path";

export function parseBootstrap(env: Record<string, string | undefined>) {
  const dataDir = env.DATA_DIR && env.DATA_DIR.trim() ? env.DATA_DIR.trim() : "data";
  const join = (f: string) => path.join(dataDir, f).split(path.sep).join("/");
  return {
    dataDir,
    dbPath: join("dmarc.db"),
    geoPath: join("GeoLite2-City.mmdb"),
    keyPath: join("app.key"),
    port: env.PORT ? Number(env.PORT) : 3000,
  };
}

let cached: ReturnType<typeof parseBootstrap> | null = null;
export function bootstrap() {
  if (!cached) cached = parseBootstrap(process.env);
  return cached;
}
