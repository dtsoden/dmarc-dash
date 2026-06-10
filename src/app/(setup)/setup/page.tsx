"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const RECIPIENTS_DEFAULT = "david.soden@beaconspec.com, duane.walker@beaconspec.com";

export default function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState("");
  const [f, setF] = useState({
    username: "", email: "", password: "",
    tenantId: "", clientId: "", clientSecret: "", mailboxUpn: "",
    intervalMinutes: 15, deleteMode: "safe",
    token: "", from: "dmarc@beaconspec.com", recipients: RECIPIENTS_DEFAULT,
    weeklyCron: "0 8 * * 1", monthlyCron: "0 8 1 * *", maxmind: "",
  });
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  async function testGraph() {
    setMsg("Testing…");
    const r = await fetch("/api/setup/test-graph", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: f.tenantId, clientId: f.clientId, clientSecret: f.clientSecret, mailboxUpn: f.mailboxUpn }) }).then((r) => r.json());
    setMsg(r.ok ? `✅ Connected (inbox reachable)` : `❌ ${r.error}`);
  }
  async function testEmail() {
    setMsg("Sending…");
    const r = await fetch("/api/setup/test-email", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: f.token, from: f.from, recipients: f.recipients.split(",").map((s) => s.trim()).filter(Boolean) }) }).then((r) => r.json());
    setMsg(r.ok ? "✅ Test email sent" : `❌ ${r.error}`);
  }
  async function finish() {
    const body = {
      admin: { username: f.username, email: f.email, password: f.password },
      graph: { tenantId: f.tenantId, clientId: f.clientId, clientSecret: f.clientSecret, mailboxUpn: f.mailboxUpn },
      poll: { intervalMinutes: Number(f.intervalMinutes), deleteMode: f.deleteMode },
      email: f.token ? { token: f.token, from: f.from, recipients: f.recipients.split(",").map((s) => s.trim()).filter(Boolean), weeklyCron: f.weeklyCron, monthlyCron: f.monthlyCron } : undefined,
      maxmind: f.maxmind ? { key: f.maxmind } : undefined,
    };
    const r = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) router.push("/"); else setMsg("❌ " + (await r.json()).error);
  }

  const input = "w-full rounded-md border px-3 py-2";
  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-2xl font-semibold">DMARC Dashboard setup</h1>
      <div className="space-y-3 rounded-xl border bg-background p-6">
        {step === 0 && (<>
          <h2 className="font-medium">1. Administrator account</h2>
          <input className={input} placeholder="Username" value={f.username} onChange={(e) => set("username", e.target.value)} />
          <input className={input} placeholder="Email" value={f.email} onChange={(e) => set("email", e.target.value)} />
          <input className={input} type="password" placeholder="Password (min 8)" value={f.password} onChange={(e) => set("password", e.target.value)} />
        </>)}
        {step === 1 && (<>
          <h2 className="font-medium">2. Microsoft Graph</h2>
          <input className={input} placeholder="Tenant ID" value={f.tenantId} onChange={(e) => set("tenantId", e.target.value)} />
          <input className={input} placeholder="Client ID" value={f.clientId} onChange={(e) => set("clientId", e.target.value)} />
          <input className={input} type="password" placeholder="Client secret" value={f.clientSecret} onChange={(e) => set("clientSecret", e.target.value)} />
          <input className={input} placeholder="Mailbox (UPN)" value={f.mailboxUpn} onChange={(e) => set("mailboxUpn", e.target.value)} />
          <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={testGraph}>Test connection</button>
        </>)}
        {step === 2 && (<>
          <h2 className="font-medium">3. Polling</h2>
          <label className="block text-sm">Check interval (minutes)
            <input className={input} type="number" min={1} value={f.intervalMinutes} onChange={(e) => set("intervalMinutes", e.target.value)} /></label>
          <label className="block text-sm">On parse failure
            <select className={input} value={f.deleteMode} onChange={(e) => set("deleteMode", e.target.value)}>
              <option value="safe">Move email to DMARC-Errors (safe)</option>
              <option value="hard">Delete email anyway (hard)</option>
            </select></label>
        </>)}
        {step === 3 && (<>
          <h2 className="font-medium">4. Email digests (optional)</h2>
          <input className={input} type="password" placeholder="MailerSend API token" value={f.token} onChange={(e) => set("token", e.target.value)} />
          <input className={input} placeholder="From address" value={f.from} onChange={(e) => set("from", e.target.value)} />
          <input className={input} placeholder="Recipients (comma-separated)" value={f.recipients} onChange={(e) => set("recipients", e.target.value)} />
          <div className="flex gap-2">
            <input className={input} placeholder="Weekly cron" value={f.weeklyCron} onChange={(e) => set("weeklyCron", e.target.value)} />
            <input className={input} placeholder="Monthly cron" value={f.monthlyCron} onChange={(e) => set("monthlyCron", e.target.value)} />
          </div>
          <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={testEmail}>Send test email</button>
        </>)}
        {step === 4 && (<>
          <h2 className="font-medium">5. GeoIP map (optional)</h2>
          <input className={input} type="password" placeholder="MaxMind GeoLite2 license key" value={f.maxmind} onChange={(e) => set("maxmind", e.target.value)} />
        </>)}
        {msg && <p className="text-sm">{msg}</p>}
        <div className="flex justify-between pt-2">
          <button type="button" disabled={step === 0} className="rounded-md border px-3 py-1.5 disabled:opacity-40" onClick={() => { setMsg(""); setStep((s) => s - 1); }}>Back</button>
          {step < 4
            ? <button type="button" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground" onClick={() => { setMsg(""); setStep((s) => s + 1); }}>Next</button>
            : <button type="button" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground" onClick={finish}>Finish</button>}
        </div>
      </div>
    </div>
  );
}
