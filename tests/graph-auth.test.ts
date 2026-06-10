import { describe, it, expect, vi } from "vitest";
import { GraphAuth } from "@/lib/graph/auth";

describe("GraphAuth", () => {
  it("requests a token and caches it until near expiry", async () => {
    const acquire = vi.fn().mockResolvedValue({ accessToken: "tok", expiresOn: new Date(Date.now() + 3600_000) });
    const auth = new GraphAuth({ tenantId: "t", clientId: "c", clientSecret: "s" }, { acquireTokenByClientCredential: acquire } as any);
    expect(await auth.getToken()).toBe("tok");
    expect(await auth.getToken()).toBe("tok");
    expect(acquire).toHaveBeenCalledTimes(1);
  });
});
