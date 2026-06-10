"use client";
import { useEffect, useRef, useState } from "react";
import { Mail, Server, Inbox, Clock, Send, Globe, Palette, Trash2, Upload, AlertTriangle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const MASK = "********";
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

interface SettingsState {
  mailbox_provider: string;
  graph_tenant_id: string;
  graph_client_id: string;
  graph_client_secret: string;
  mailbox_upn: string;
  imap_host: string;
  imap_port: number;
  imap_username: string;
  imap_password: string;
  imap_tls: boolean;
  imap_folder: string;
  poll_interval_minutes: number;
  delete_mode: string;
  mailersend_token: string;
  mailersend_from: string;
  digest_recipients: string; // comma-separated in the form
  digest_weekly_cron: string;
  digest_monthly_cron: string;
  maxmind_license_key: string;
  brand_app_name: string;
  brand_primary: string;
  brand_accent: string;
  brand_logo_ext: string;
  brand_favicon_ext: string;
}

const EMPTY: SettingsState = {
  mailbox_provider: "",
  graph_tenant_id: "", graph_client_id: "", graph_client_secret: "", mailbox_upn: "",
  imap_host: "", imap_port: 993, imap_username: "", imap_password: "", imap_tls: true, imap_folder: "INBOX",
  poll_interval_minutes: 15, delete_mode: "safe",
  mailersend_token: "", mailersend_from: "", digest_recipients: "",
  digest_weekly_cron: "", digest_monthly_cron: "", maxmind_license_key: "",
  brand_app_name: "DMARC Dashboard", brand_primary: "#0093a2", brand_accent: "#00df7e",
  brand_logo_ext: "", brand_favicon_ext: "",
};

const input = "w-full rounded-md border px-3 py-2";
const labelCls = "block text-sm font-medium mb-1";
const btnPrimary = "rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60";
const btnGhost = "rounded-lg border px-3.5 py-2 text-sm";
const card = "card-elev space-y-4 rounded-2xl border border-border bg-card p-6";

export function SettingsForm() {
  const [f, setF] = useState<SettingsState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof SettingsState>(k: K, v: SettingsState[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  function load() {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const recipients = Array.isArray(d.digest_recipients) ? d.digest_recipients.join(", ") : "";
        setF({
          mailbox_provider: d.mailbox_provider ?? "",
          graph_tenant_id: d.graph_tenant_id ?? "",
          graph_client_id: d.graph_client_id ?? "",
          graph_client_secret: d.graph_client_secret ?? "",
          mailbox_upn: d.mailbox_upn ?? "",
          imap_host: d.imap_host ?? "",
          imap_port: Number(d.imap_port ?? 993),
          imap_username: d.imap_username ?? "",
          imap_password: d.imap_password ?? "",
          imap_tls: d.imap_tls ?? true,
          imap_folder: d.imap_folder ?? "INBOX",
          poll_interval_minutes: Number(d.poll_interval_minutes ?? 15),
          delete_mode: d.delete_mode ?? "safe",
          mailersend_token: d.mailersend_token ?? "",
          mailersend_from: d.mailersend_from ?? "",
          digest_recipients: recipients,
          digest_weekly_cron: d.digest_weekly_cron ?? "",
          digest_monthly_cron: d.digest_monthly_cron ?? "",
          maxmind_license_key: d.maxmind_license_key ?? "",
          brand_app_name: d.brand_app_name ?? "DMARC Dashboard",
          brand_primary: d.brand_primary ?? "#0093a2",
          brand_accent: d.brand_accent ?? "#00df7e",
          brand_logo_ext: d.brand_logo_ext ?? "",
          brand_favicon_ext: d.brand_favicon_ext ?? "",
        });
        setLoaded(true);
      })
      .catch(() => setMsg("Failed to load settings"));
  }

  useEffect(() => { load(); }, []);

  // Save the generic settings (everything except branding files, which use their own endpoints).
  async function save(extra?: Partial<Record<keyof SettingsState, unknown>>) {
    setMsg("Saving...");
    const body: Record<string, unknown> = {
      ...f,
      poll_interval_minutes: Number(f.poll_interval_minutes),
      imap_port: Number(f.imap_port),
      digest_recipients: f.digest_recipients.split(",").map((s) => s.trim()).filter(Boolean),
      ...extra,
    };
    // brand_logo_ext / brand_favicon_ext are managed by the upload endpoints; don't push them back.
    delete body.brand_logo_ext;
    delete body.brand_favicon_ext;
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setMsg(r.ok ? "Saved" : "Save failed");
    return r.ok;
  }

  async function saveBranding() {
    if (f.brand_primary && !HEX_RE.test(f.brand_primary)) { setMsg("Primary color must be a hex value like #0093a2."); return; }
    if (f.brand_accent && !HEX_RE.test(f.brand_accent)) { setMsg("Accent color must be a hex value like #00df7e."); return; }
    const ok = await save();
    if (ok) location.reload(); // re-render runtime theme + document title
  }

  async function testConnection() {
    setTestMsg("Testing connection...");
    try {
      if (f.mailbox_provider === "graph") {
        const r = await fetch("/api/setup/test-graph", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId: f.graph_tenant_id.trim(), clientId: f.graph_client_id.trim(), clientSecret: f.graph_client_secret, mailboxUpn: f.mailbox_upn.trim() }) }).then((r) => r.json());
        setTestMsg(r.ok ? "Connected: the mailbox is reachable." : `Connection failed: ${r.error}`);
      } else if (f.mailbox_provider === "imap") {
        const r = await fetch("/api/setup/test-imap", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host: f.imap_host.trim(), port: Number(f.imap_port), username: f.imap_username.trim(), password: f.imap_password, tls: f.imap_tls, folder: f.imap_folder.trim() || "INBOX" }) }).then((r) => r.json());
        setTestMsg(r.ok ? "Connected: the mailbox is reachable." : `Connection failed: ${r.error}`);
      }
    } catch { setTestMsg("Connection test failed to reach the server."); }
  }

  async function clearSource() {
    if (!confirm("Clear the mailbox source configuration? This blanks both Graph and IMAP credentials so you can switch providers.")) return;
    setMsg("Clearing...");
    const r = await fetch("/api/settings/clear-source", { method: "POST" });
    if (r.ok) { location.reload(); } else { setMsg("Failed to clear source"); }
  }

  // Save the current provider's source settings (used when no provider is set yet, or to update an existing one).
  async function saveSource(provider?: string) {
    const ok = await save(provider ? { mailbox_provider: provider } : undefined);
    if (ok) location.reload();
  }

  async function uploadBrand(kind: "logo" | "favicon", file: File) {
    setMsg(`Uploading ${kind}...`);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`/api/brand/${kind}`, { method: "POST", body: fd });
    if (r.ok) { location.reload(); } else { setMsg(`Failed to upload ${kind}`); }
  }
  async function removeBrand(kind: "logo" | "favicon") {
    setMsg(`Removing ${kind}...`);
    const r = await fetch(`/api/brand/${kind}`, { method: "DELETE" });
    if (r.ok) { location.reload(); } else { setMsg(`Failed to remove ${kind}`); }
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">Loading...</p>;

  const provider = f.mailbox_provider;
  const hasProvider = provider === "graph" || provider === "imap";

  return (
    <Tabs defaultValue="source" className="w-full">
      <TabsList className="flex flex-wrap">
        <TabsTrigger value="source"><Inbox /> Mailbox Monitoring</TabsTrigger>
        <TabsTrigger value="polling"><Clock /> Polling</TabsTrigger>
        <TabsTrigger value="email"><Send /> Notifications</TabsTrigger>
        <TabsTrigger value="geoip"><Globe /> GeoIP</TabsTrigger>
        <TabsTrigger value="branding"><Palette /> Branding</TabsTrigger>
      </TabsList>

      {/* MAILBOX MONITORING */}
      <TabsContent value="source" className="pt-4">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The mailbox the dashboard monitors for DMARC aggregate reports. Choose one source:
            {hasProvider
              ? <> currently <span className="font-medium text-foreground">{provider === "graph" ? "Microsoft 365" : "IMAP"}</span>. The other is locked until you clear it below.</>
              : <> Microsoft 365 (Graph) for Office 365 tenants, or IMAP for Gmail/Workspace and others.</>}
          </p>

          <Tabs defaultValue={provider === "imap" ? "imap" : "graph"} className="w-full">
            <TabsList>
              <TabsTrigger value="graph" disabled={hasProvider && provider !== "graph"}>
                <Mail /> Microsoft 365
                {provider === "graph" && <span className="ml-1.5 rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-semibold text-white">ACTIVE</span>}
              </TabsTrigger>
              <TabsTrigger value="imap" disabled={hasProvider && provider !== "imap"}>
                <Server /> IMAP
                {provider === "imap" && <span className="ml-1.5 rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-semibold text-white">ACTIVE</span>}
              </TabsTrigger>
            </TabsList>

            {/* Microsoft 365 sub-tab */}
            <TabsContent value="graph" className="pt-4">
              <section className={card}>
                <h2 className="font-display font-medium">Microsoft 365 (Microsoft Graph)</h2>
                <p className="text-xs text-muted-foreground">App-only access to a 365 mailbox. See docs/SETUP-ENTRA.md for the one-time Entra app registration.</p>
                <div><label className={labelCls}>Tenant ID</label>
                  <input className={input} value={f.graph_tenant_id} onChange={(e) => set("graph_tenant_id", e.target.value)} /></div>
                <div><label className={labelCls}>Client ID</label>
                  <input className={input} value={f.graph_client_id} onChange={(e) => set("graph_client_id", e.target.value)} /></div>
                <div><label className={labelCls}>Client secret</label>
                  <input className={input} type="password" value={f.graph_client_secret} onChange={(e) => set("graph_client_secret", e.target.value)} /></div>
                <div><label className={labelCls}>Mailbox (UPN)</label>
                  <input className={input} value={f.mailbox_upn} onChange={(e) => set("mailbox_upn", e.target.value)} /></div>
                <div className="flex flex-wrap items-center gap-2">
                  {provider === "graph"
                    ? <><button type="button" className={btnPrimary} onClick={() => saveSource()}>Save</button>
                        <button type="button" className={btnGhost} onClick={testConnection}>Test connection</button></>
                    : <button type="button" className={btnPrimary} onClick={() => saveSource("graph")}>Use Microsoft 365</button>}
                </div>
              </section>
            </TabsContent>

            {/* IMAP sub-tab */}
            <TabsContent value="imap" className="pt-4">
              <section className={card}>
                <h2 className="font-display font-medium">IMAP (Gmail, Workspace, Fastmail, other)</h2>
                <p className="text-xs text-muted-foreground">Gmail/Workspace need an app password (with 2FA). Host examples: imap.gmail.com:993, imap.fastmail.com:993.</p>
                <div><label className={labelCls}>Host</label>
                  <input className={input} value={f.imap_host} onChange={(e) => set("imap_host", e.target.value)} /></div>
                <div><label className={labelCls}>Port</label>
                  <input className={input} type="number" min={1} max={65535} value={f.imap_port} onChange={(e) => set("imap_port", Number(e.target.value))} /></div>
                <div><label className={labelCls}>Username</label>
                  <input className={input} value={f.imap_username} onChange={(e) => set("imap_username", e.target.value)} /></div>
                <div><label className={labelCls}>Password (app password)</label>
                  <input className={input} type="password" value={f.imap_password} onChange={(e) => set("imap_password", e.target.value)} /></div>
                <div><label className={labelCls}>Encryption</label>
                  <select className={input} value={f.imap_tls ? "tls" : "plain"} onChange={(e) => set("imap_tls", e.target.value === "tls")}>
                    <option value="tls">TLS / SSL (recommended)</option>
                    <option value="plain">None</option>
                  </select></div>
                <div><label className={labelCls}>Folder</label>
                  <input className={input} value={f.imap_folder} onChange={(e) => set("imap_folder", e.target.value)} /></div>
                <div className="flex flex-wrap items-center gap-2">
                  {provider === "imap"
                    ? <><button type="button" className={btnPrimary} onClick={() => saveSource()}>Save</button>
                        <button type="button" className={btnGhost} onClick={testConnection}>Test connection</button></>
                    : <button type="button" className={btnPrimary} onClick={() => saveSource("imap")}>Use IMAP</button>}
                </div>
              </section>
            </TabsContent>
          </Tabs>

          {hasProvider && (
            <section className="card-elev space-y-3 rounded-2xl border border-destructive/40 bg-card p-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-destructive" />
                <h2 className="font-display font-medium">Switch provider</h2>
              </div>
              <p className="text-sm text-muted-foreground">Clearing the source blanks both Microsoft 365 and IMAP credentials and stops polling until a new source is configured.</p>
              <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 px-3.5 py-2 text-sm font-medium text-destructive hover:bg-destructive/10" onClick={clearSource}>
                <Trash2 className="size-4" /> Clear source configuration
              </button>
            </section>
          )}

          {testMsg && <p className="text-sm text-muted-foreground">{testMsg}</p>}
          {msg && <p className="text-sm">{msg}</p>}
        </div>
      </TabsContent>

      {/* POLLING */}
      <TabsContent value="polling" className="pt-4">
        <section className={card}>
          <h2 className="font-display font-medium">Polling</h2>
          <div><label className={labelCls}>Check interval (minutes)</label>
            <input className={input} type="number" min={1} max={1440} value={f.poll_interval_minutes}
              onChange={(e) => set("poll_interval_minutes", Number(e.target.value))} /></div>
          <div><label className={labelCls}>On parse failure</label>
            <select className={input} value={f.delete_mode} onChange={(e) => set("delete_mode", e.target.value)}>
              <option value="safe">Move email to DMARC-Errors (safe)</option>
              <option value="hard">Delete email anyway (hard)</option>
            </select></div>
          <SaveBar onSave={() => save()} msg={msg} />
        </section>
      </TabsContent>

      {/* NOTIFICATIONS (outbound email / SMTP) */}
      <TabsContent value="email" className="pt-4">
        <section className={card}>
          <h2 className="font-display font-medium">Notifications</h2>
          <p className="text-xs text-muted-foreground">Outbound email used to <span className="font-medium text-foreground">send</span> the weekly/monthly digest reports and password-reset messages (delivered via MailerSend). This is separate from the mailbox the dashboard monitors.</p>
          <div><label className={labelCls}>MailerSend API token</label>
            <input className={input} type="password" value={f.mailersend_token} onChange={(e) => set("mailersend_token", e.target.value)} /></div>
          <div><label className={labelCls}>From address</label>
            <input className={input} value={f.mailersend_from} onChange={(e) => set("mailersend_from", e.target.value)} /></div>
          <div><label className={labelCls}>Recipients (comma-separated)</label>
            <input className={input} value={f.digest_recipients} onChange={(e) => set("digest_recipients", e.target.value)} /></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className={labelCls}>Weekly cron</label>
              <input className={input} value={f.digest_weekly_cron} onChange={(e) => set("digest_weekly_cron", e.target.value)} /></div>
            <div className="flex-1"><label className={labelCls}>Monthly cron</label>
              <input className={input} value={f.digest_monthly_cron} onChange={(e) => set("digest_monthly_cron", e.target.value)} /></div>
          </div>
          <SaveBar onSave={() => save()} msg={msg} />
        </section>
      </TabsContent>

      {/* GEOIP (optional) */}
      <TabsContent value="geoip" className="pt-4">
        <section className={card}>
          <h2 className="font-display font-medium">GeoIP <span className="text-sm font-normal text-muted-foreground">(optional)</span></h2>
          <p className="text-xs text-muted-foreground">Powers the world map of sending IPs on the Sources page. Optional. Uses a free MaxMind GeoLite2 license key; without it everything else still works.</p>
          <div><label className={labelCls}>MaxMind GeoLite2 license key</label>
            <input className={input} type="password" value={f.maxmind_license_key} onChange={(e) => set("maxmind_license_key", e.target.value)} /></div>
          <SaveBar onSave={() => save()} msg={msg} />
        </section>
      </TabsContent>

      {/* BRANDING */}
      <TabsContent value="branding" className="pt-4">
        <div className="space-y-4">
          <section className={card}>
            <h2 className="font-display font-medium">White-label</h2>
            <div><label className={labelCls}>Application name</label>
              <input className={input} value={f.brand_app_name} onChange={(e) => set("brand_app_name", e.target.value)} /></div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className={labelCls}>Primary color</label>
                <div className="flex items-center gap-2">
                  <input type="color" className="h-10 w-12 rounded-md border" value={HEX_RE.test(f.brand_primary) ? f.brand_primary : "#0093a2"} onChange={(e) => set("brand_primary", e.target.value)} />
                  <input className={input + " font-mono"} value={f.brand_primary} onChange={(e) => set("brand_primary", e.target.value)} />
                </div>
              </div>
              <div className="flex-1">
                <label className={labelCls}>Accent color</label>
                <div className="flex items-center gap-2">
                  <input type="color" className="h-10 w-12 rounded-md border" value={HEX_RE.test(f.brand_accent) ? f.brand_accent : "#00df7e"} onChange={(e) => set("brand_accent", e.target.value)} />
                  <input className={input + " font-mono"} value={f.brand_accent} onChange={(e) => set("brand_accent", e.target.value)} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" className={btnPrimary} onClick={saveBranding}>Save and reload</button>
              {msg && <p className="text-sm">{msg}</p>}
            </div>
          </section>

          <section className={card}>
            <h2 className="font-display font-medium">Logo</h2>
            {f.brand_logo_ext
              ? <div className="flex items-center gap-3">
                  <img src="/api/brand/logo" alt="Logo" className="h-12 w-auto max-w-[200px] rounded-md border bg-background p-1" />
                  <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10" onClick={() => removeBrand("logo")}><Trash2 className="size-4" /> Remove</button>
                </div>
              : <p className="text-sm text-muted-foreground">No custom logo (the wordmark is shown).</p>}
            <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadBrand("logo", file); e.target.value = ""; }} />
            <button type="button" className={`inline-flex items-center gap-2 ${btnGhost}`} onClick={() => logoInput.current?.click()}><Upload className="size-4" /> Upload logo</button>
          </section>

          <section className={card}>
            <h2 className="font-display font-medium">Favicon</h2>
            {f.brand_favicon_ext
              ? <div className="flex items-center gap-3">
                  <img src="/api/brand/favicon" alt="Favicon" className="h-10 w-10 rounded-md border bg-background p-1" />
                  <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10" onClick={() => removeBrand("favicon")}><Trash2 className="size-4" /> Remove</button>
                </div>
              : <p className="text-sm text-muted-foreground">No custom favicon (the default is shown).</p>}
            <input ref={faviconInput} type="file" accept="image/*,.ico" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadBrand("favicon", file); e.target.value = ""; }} />
            <button type="button" className={`inline-flex items-center gap-2 ${btnGhost}`} onClick={() => faviconInput.current?.click()}><Upload className="size-4" /> Upload favicon</button>
          </section>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function SaveBar({ onSave, msg }: { onSave: () => void; msg: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button type="button" className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground" onClick={onSave}>Save</button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
