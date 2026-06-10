"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Server, Check } from "lucide-react";

const RECIPIENTS_DEFAULT = "david.soden@beaconspec.com, duane.walker@beaconspec.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ProviderChoice = "graph" | "imap";

export default function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<ProviderChoice>("graph");
  const [f, setF] = useState({
    username: "", email: "", password: "",
    tenantId: "", clientId: "", clientSecret: "", mailboxUpn: "",
    imapHost: "", imapPort: "993", imapUsername: "", imapPassword: "", imapTls: true, imapFolder: "INBOX",
    intervalMinutes: "15", deleteMode: "safe",
    token: "", from: "dmarc@beaconspec.com", recipients: RECIPIENTS_DEFAULT,
    weeklyCron: "0 8 * * 1", monthlyCron: "0 8 1 * *", maxmind: "",
  });
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  // Per-step validation. Returns an error string, or "" when the step is valid.
  function validateStep(s: number): string {
    if (s === 0) {
      if (!f.username.trim()) return "Enter a username.";
      if (!EMAIL_RE.test(f.email.trim())) return "Enter a valid admin email address.";
      if (f.password.length < 8) return "Admin password must be at least 8 characters.";
    }
    if (s === 1) {
      if (provider === "graph") {
        if (!f.tenantId.trim()) return "Tenant ID is required.";
        if (!f.clientId.trim()) return "Client ID is required.";
        if (!f.clientSecret.trim()) return "Client secret is required.";
        if (!EMAIL_RE.test(f.mailboxUpn.trim())) return "Mailbox (UPN) must be a valid email address, e.g. dmarc@yourdomain.com.";
      } else {
        if (!f.imapHost.trim()) return "IMAP host is required.";
        const p = Number(f.imapPort);
        if (!Number.isInteger(p) || p < 1 || p > 65535) return "IMAP port must be a whole number between 1 and 65535.";
        if (!f.imapUsername.trim()) return "IMAP username is required.";
        if (!f.imapPassword.trim()) return "IMAP password is required.";
      }
    }
    if (s === 2) {
      const n = Number(f.intervalMinutes);
      if (!Number.isInteger(n) || n < 1 || n > 1440) return "Check interval must be a whole number of minutes between 1 and 1440.";
    }
    if (s === 3 && f.token.trim()) {
      if (!f.from.trim()) return "A from-address is required when a MailerSend token is set.";
      if (!f.recipients.split(",").map((x) => x.trim()).filter(Boolean).length) return "Add at least one recipient, or clear the MailerSend token to skip email.";
    }
    return "";
  }

  function next() {
    const e = validateStep(step);
    if (e) { setErr(e); return; }
    setErr(""); setMsg(""); setStep((s) => s + 1);
  }
  function back() { setErr(""); setMsg(""); setStep((s) => s - 1); }

  async function testGraph() {
    const e = validateStep(1);
    if (e) { setErr(e); return; }
    setErr(""); setMsg("Testing connection...");
    try {
      const r = await fetch("/api/setup/test-graph", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: f.tenantId.trim(), clientId: f.clientId.trim(), clientSecret: f.clientSecret, mailboxUpn: f.mailboxUpn.trim() }) }).then((r) => r.json());
      setMsg(r.ok ? "Connected: the mailbox is reachable." : `Connection failed: ${r.error}`);
    } catch { setMsg("Connection test failed to reach the server."); }
  }
  async function testImap() {
    const e = validateStep(1);
    if (e) { setErr(e); return; }
    setErr(""); setMsg("Testing connection...");
    try {
      const r = await fetch("/api/setup/test-imap", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: f.imapHost.trim(), port: Number(f.imapPort), username: f.imapUsername.trim(), password: f.imapPassword, tls: f.imapTls, folder: f.imapFolder.trim() || "INBOX" }) }).then((r) => r.json());
      setMsg(r.ok ? "Connected: the mailbox is reachable." : `Connection failed: ${r.error}`);
    } catch { setMsg("Connection test failed to reach the server."); }
  }
  async function testEmail() {
    setMsg("Sending test email...");
    try {
      const r = await fetch("/api/setup/test-email", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: f.token, from: f.from.trim(), recipients: f.recipients.split(",").map((x) => x.trim()).filter(Boolean) }) }).then((r) => r.json());
      setMsg(r.ok ? "Test email sent." : `Email failed: ${r.error}`);
    } catch { setMsg("Test email failed to reach the server."); }
  }

  // Turn the server's zod error (a JSON array) into one readable line.
  function readableServerError(raw: string): string {
    try {
      const issues = JSON.parse(raw);
      if (Array.isArray(issues)) return issues.map((i: any) => `${(i.path || []).join(".") || "field"}: ${i.message}`).join("; ");
    } catch { /* not JSON */ }
    return raw;
  }

  async function finish() {
    for (let s = 0; s <= 3; s++) {
      const e = validateStep(s);
      if (e) { setStep(s); setErr(e); return; }
    }
    setErr(""); setBusy(true); setMsg("Saving...");
    const body: Record<string, unknown> = {
      admin: { username: f.username.trim(), email: f.email.trim(), password: f.password },
      provider,
      poll: { intervalMinutes: Number(f.intervalMinutes), deleteMode: f.deleteMode },
      email: f.token.trim() ? { token: f.token, from: f.from.trim(), recipients: f.recipients.split(",").map((x) => x.trim()).filter(Boolean), weeklyCron: f.weeklyCron.trim(), monthlyCron: f.monthlyCron.trim() } : undefined,
      maxmind: f.maxmind.trim() ? { key: f.maxmind.trim() } : undefined,
    };
    if (provider === "graph") {
      body.graph = { tenantId: f.tenantId.trim(), clientId: f.clientId.trim(), clientSecret: f.clientSecret, mailboxUpn: f.mailboxUpn.trim() };
    } else {
      body.imap = { host: f.imapHost.trim(), port: Number(f.imapPort), username: f.imapUsername.trim(), password: f.imapPassword, tls: f.imapTls, folder: f.imapFolder.trim() || "INBOX" };
    }
    try {
      const r = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) { router.push("/"); return; }
      let detail = `HTTP ${r.status}`;
      try { detail = readableServerError((await r.json()).error ?? detail); } catch { /* non-JSON body */ }
      setBusy(false); setMsg(""); setErr(detail);
    } catch {
      setBusy(false); setMsg(""); setErr("Could not reach the server to save setup.");
    }
  }

  const input = "w-full rounded-md border px-3 py-2";
  const labelCls = "block text-sm font-medium mb-1";

  function selectProvider(p: ProviderChoice) {
    setProvider(p); setErr(""); setMsg("");
  }

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="mb-1 font-display text-2xl font-semibold">DMARC Dashboard setup</h1>
      <p className="mb-6 text-sm text-muted-foreground">Step {step + 1} of 5</p>
      <div className="card-elev space-y-3 rounded-2xl border border-border bg-card p-6">
        {step === 0 && (<>
          <h2 className="font-display font-medium">1. Administrator account</h2>
          <p className="text-sm text-muted-foreground">This is the login you will use. There are no default credentials.</p>
          <div><label className={labelCls}>Username</label>
            <input className={input} value={f.username} onChange={(e) => set("username", e.target.value)} /></div>
          <div><label className={labelCls}>Email</label>
            <input className={input} value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div><label className={labelCls}>Password (8+ characters)</label>
            <input className={input} type="password" value={f.password} onChange={(e) => set("password", e.target.value)} /></div>
        </>)}

        {step === 1 && (<>
          <h2 className="font-display font-medium">2. Mailbox source</h2>
          <p className="text-sm text-muted-foreground">Where do your DMARC reports arrive? Pick one source. You can switch later from Settings.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => selectProvider("graph")}
              className={`relative flex flex-col gap-1 rounded-2xl border p-4 text-left transition ${provider === "graph" ? "border-primary bg-primary/5 brand-glow" : "border-border bg-card hover:border-primary/40"}`}>
              {provider === "graph" && <Check className="absolute right-3 top-3 size-4 text-primary" />}
              <Mail className="size-5 text-primary" />
              <span className="font-medium">Microsoft 365 (Graph)</span>
              <span className="text-xs text-muted-foreground">Azure app registration with Mail.ReadWrite.</span>
            </button>
            <button type="button" onClick={() => selectProvider("imap")}
              className={`relative flex flex-col gap-1 rounded-2xl border p-4 text-left transition ${provider === "imap" ? "border-primary bg-primary/5 brand-glow" : "border-border bg-card hover:border-primary/40"}`}>
              {provider === "imap" && <Check className="absolute right-3 top-3 size-4 text-primary" />}
              <Server className="size-5 text-primary" />
              <span className="font-medium">IMAP (Gmail, Workspace, other)</span>
              <span className="text-xs text-muted-foreground">Standard IMAP with an app password.</span>
            </button>
          </div>

          {provider === "graph" && (<div className="space-y-3 pt-2">
            <details className="rounded-md border bg-muted/40 p-3 text-sm">
              <summary className="cursor-pointer font-medium">How do I get these values? (one-time Azure setup)</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Go to <span className="font-mono">entra.microsoft.com</span> &rarr; Applications &rarr; App registrations &rarr; New registration. Name it "DMARC Dashboard", choose Single tenant, Register.</li>
                <li>On the Overview page copy <b>Directory (tenant) ID</b> &rarr; Tenant ID, and <b>Application (client) ID</b> &rarr; Client ID.</li>
                <li>Certificates &amp; secrets &rarr; New client secret &rarr; copy the <b>Value</b> (not the Secret ID) &rarr; Client secret.</li>
                <li>API permissions &rarr; Add a permission &rarr; Microsoft Graph &rarr; <b>Application permissions</b> &rarr; pick <b>Mail.ReadWrite</b> ("Read and write mail in all mailboxes") &rarr; Add, then <b>Grant admin consent</b> (status must turn green).</li>
                <li>Mailbox (UPN) is simply the email address that receives your DMARC reports, e.g. <span className="font-mono">dmarc@yourdomain.com</span>. No Graph Explorer needed.</li>
              </ol>
              <p className="mt-2">Full walkthrough incl. locking access to one mailbox: <span className="font-mono">docs/SETUP-ENTRA.md</span>.</p>
            </details>
            <div><label className={labelCls}>Tenant ID</label>
              <input className={input} value={f.tenantId} onChange={(e) => set("tenantId", e.target.value)} /></div>
            <div><label className={labelCls}>Client ID</label>
              <input className={input} value={f.clientId} onChange={(e) => set("clientId", e.target.value)} /></div>
            <div><label className={labelCls}>Client secret</label>
              <input className={input} type="password" value={f.clientSecret} onChange={(e) => set("clientSecret", e.target.value)} /></div>
            <div><label className={labelCls}>Mailbox (UPN) - the report mailbox address</label>
              <input className={input} placeholder="dmarc@yourdomain.com" value={f.mailboxUpn} onChange={(e) => set("mailboxUpn", e.target.value)} /></div>
            <button type="button" className="rounded-lg border px-3.5 py-2 text-sm" onClick={testGraph}>Test connection</button>
          </div>)}

          {provider === "imap" && (<div className="space-y-3 pt-2">
            <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Gmail/Workspace need an app password (with 2FA). Host examples: <span className="font-mono">imap.gmail.com:993</span>, <span className="font-mono">imap.fastmail.com:993</span>.</p>
            <div><label className={labelCls}>Host</label>
              <input className={input} placeholder="imap.gmail.com" value={f.imapHost} onChange={(e) => set("imapHost", e.target.value)} /></div>
            <div><label className={labelCls}>Port</label>
              <input className={input} type="number" min={1} max={65535} value={f.imapPort} onChange={(e) => set("imapPort", e.target.value)} /></div>
            <div><label className={labelCls}>Username</label>
              <input className={input} placeholder="dmarc@yourdomain.com" value={f.imapUsername} onChange={(e) => set("imapUsername", e.target.value)} /></div>
            <div><label className={labelCls}>Password (app password)</label>
              <input className={input} type="password" value={f.imapPassword} onChange={(e) => set("imapPassword", e.target.value)} /></div>
            <div><label className={labelCls}>Encryption</label>
              <select className={input} value={f.imapTls ? "tls" : "plain"} onChange={(e) => set("imapTls", e.target.value === "tls")}>
                <option value="tls">TLS / SSL (recommended)</option>
                <option value="plain">None</option>
              </select></div>
            <div><label className={labelCls}>Folder</label>
              <input className={input} value={f.imapFolder} onChange={(e) => set("imapFolder", e.target.value)} /></div>
            <button type="button" className="rounded-lg border px-3.5 py-2 text-sm" onClick={testImap}>Test connection</button>
          </div>)}
        </>)}

        {step === 2 && (<>
          <h2 className="font-display font-medium">3. Polling</h2>
          <div><label className={labelCls}>Check interval (minutes, 1-1440)</label>
            <input className={input} type="number" min={1} max={1440} value={f.intervalMinutes} onChange={(e) => set("intervalMinutes", e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Tip: set to 1 while testing so the first poll runs within a minute. You can raise it later in Settings.</p></div>
          <div><label className={labelCls}>On parse failure</label>
            <select className={input} value={f.deleteMode} onChange={(e) => set("deleteMode", e.target.value)}>
              <option value="safe">Move email to DMARC-Errors folder (safe)</option>
              <option value="hard">Delete email anyway (hard)</option>
            </select></div>
        </>)}

        {step === 3 && (<>
          <h2 className="font-display font-medium">4. Email digests (optional)</h2>
          <p className="text-sm text-muted-foreground">Leave the token blank to skip email entirely. Used for weekly/monthly digests and password-reset emails.</p>
          <div><label className={labelCls}>MailerSend API token</label>
            <input className={input} type="password" value={f.token} onChange={(e) => set("token", e.target.value)} /></div>
          <div><label className={labelCls}>From address (must be a verified MailerSend sender)</label>
            <input className={input} value={f.from} onChange={(e) => set("from", e.target.value)} /></div>
          <div><label className={labelCls}>Recipients (comma-separated)</label>
            <input className={input} value={f.recipients} onChange={(e) => set("recipients", e.target.value)} /></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className={labelCls}>Weekly schedule (cron)</label>
              <input className={input} value={f.weeklyCron} onChange={(e) => set("weeklyCron", e.target.value)} /></div>
            <div className="flex-1"><label className={labelCls}>Monthly schedule (cron)</label>
              <input className={input} value={f.monthlyCron} onChange={(e) => set("monthlyCron", e.target.value)} /></div>
          </div>
          <button type="button" className="rounded-lg border px-3.5 py-2 text-sm" onClick={testEmail}>Send test email</button>
        </>)}

        {step === 4 && (<>
          <h2 className="font-display font-medium">5. GeoIP map (optional)</h2>
          <p className="text-sm text-muted-foreground">Powers the world map of sending IPs. Needs a free MaxMind GeoLite2 license key (free account, no payment). Leave blank to skip; you can add it later in Settings.</p>
          <div><label className={labelCls}>MaxMind GeoLite2 license key</label>
            <input className={input} type="password" value={f.maxmind} onChange={(e) => set("maxmind", e.target.value)} /></div>
        </>)}

        {err && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

        <div className="flex justify-between pt-2">
          <button type="button" disabled={step === 0 || busy} className="rounded-lg border px-3.5 py-2 text-sm disabled:opacity-40" onClick={back}>Back</button>
          {step < 4
            ? <button type="button" disabled={busy} className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground" onClick={next}>Next</button>
            : <button type="button" disabled={busy} className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" onClick={finish}>{busy ? "Saving..." : "Finish"}</button>}
        </div>
      </div>
    </div>
  );
}
