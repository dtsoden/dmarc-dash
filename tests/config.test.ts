import { describe, it, expect } from "vitest";
import { parseBootstrap } from "@/lib/config";

describe("parseBootstrap", () => {
  it("defaults DATA_DIR to data and derives paths", () => {
    const c = parseBootstrap({});
    expect(c.dataDir).toBe("data");
    expect(c.dbPath).toBe("data/dmarc.db");
    expect(c.geoPath).toBe("data/GeoLite2-City.mmdb");
    expect(c.keyPath).toBe("data/app.key");
    expect(c.port).toBe(3000);
  });
  it("honors a custom DATA_DIR and PORT", () => {
    const c = parseBootstrap({ DATA_DIR: "/var/dmarc", PORT: "8080" });
    expect(c.dbPath).toBe("/var/dmarc/dmarc.db");
    expect(c.port).toBe(8080);
  });
});
