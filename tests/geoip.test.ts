import { describe, it, expect } from "vitest";
import { locate } from "@/lib/geo/geoip";

describe("geoip", () => {
  it("returns null when no mmdb is present", async () => {
    expect(await locate("8.8.8.8")).toBeNull();
  });
});
