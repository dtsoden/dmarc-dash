import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendEmail } from "@/lib/email/mailersend";

describe("sendEmail", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  it("POSTs to MailerSend with auth header and recipients", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    await sendEmail({
      token: "tok", from: "dmarc@beaconspec.com", fromName: "DMARC",
      to: ["a@x.com", "b@x.com"], subject: "Weekly", html: "<p>hi</p>",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.mailersend.com/v1/email");
    expect((init.headers as any).Authorization).toBe("Bearer tok");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual([{ email: "a@x.com" }, { email: "b@x.com" }]);
    expect(body.subject).toBe("Weekly");
  });

  it("throws on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => "bad" }));
    await expect(sendEmail({ token: "t", from: "f@x.com", to: ["a@x.com"], subject: "s", html: "h" }))
      .rejects.toThrow(/422/);
  });
});
