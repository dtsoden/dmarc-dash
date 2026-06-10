"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Mail, Server, Inbox, Clock, Send, Globe, Palette, Trash2, Upload, Plus, CheckCircle, AlertTriangle, Pencil, Download, ShieldAlert, DatabaseBackup } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDialog } from "@/components/dialog";
import { HelpLink } from "@/components/help-link";
import { RestoreCard } from "@/components/restore-card";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

// Readable text (near-black or white) on a given hex, matching the server's logic.
function previewText(hex: string): string {
  const h = (hex || "").replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (f.length !== 6) return "#ffffff";
  const r = parseInt(f.slice(0, 2), 16) / 255, g = parseInt(f.slice(2, 4), 16) / 255, b = parseInt(f.slice(4, 6), 16) / 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.6 ? "#0b1a14" : "#ffffff";
}

interface SettingsState {
  poll_interval_minutes: number;
  delete_mode: string;
  mailersend_token: string;
  mailersend_from: string;
  digest_recipients: string; // comma-separated in the form
  digest_weekly_cron: string;
  digest_monthly_cron: string;
  maxmind_license_key: string;
  brand_app_name: string;
  brand_color_light: string;
  brand_color_dark: string;
  brand_default_theme: string;
  brand_logo_ext: string;
  brand_favicon_ext: string;
}

const EMPTY: SettingsState = {
  poll_interval_minutes: 15, delete_mode: "safe",
  mailersend_token: "", mailersend_from: "", digest_recipients: "",
  digest_weekly_cron: "", digest_monthly_cron: "", maxmind_license_key: "",
  brand_app_name: "DMARC Dashboard", brand_color_light: "#0093a2", brand_color_dark: "#00df7e",
  brand_default_theme: "dark", brand_logo_ext: "", brand_favicon_ext: "",
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
  const [brandTab, setBrandTab] = useState<"light" | "dark">("light");
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
          poll_interval_minutes: Number(d.poll_interval_minutes ?? 15),
          delete_mode: d.delete_mode ?? "safe",
          mailersend_token: d.mailersend_token ?? "",
          mailersend_from: d.mailersend_from ?? "",
          digest_recipients: recipients,
          digest_weekly_cron: d.digest_weekly_cron ?? "",
          digest_monthly_cron: d.digest_monthly_cron ?? "",
          maxmind_license_key: d.maxmind_license_key ?? "",
          brand_app_name: d.brand_app_name ?? "DMARC Dashboard",
          brand_color_light: d.brand_color_light ?? "#0093a2",
          brand_color_dark: d.brand_color_dark ?? "#00df7e",
          brand_default_theme: d.brand_default_theme ?? "dark",
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
    if (f.brand_color_light && !HEX_RE.test(f.brand_color_light)) { setMsg("Light brand color must be a hex value like #0093a2."); return; }
    if (f.brand_color_dark && !HEX_RE.test(f.brand_color_dark)) { setMsg("Dark brand color must be a hex value like #00df7e."); return; }
    const ok = await save();
    if (ok) location.reload(); // re-render runtime theme + document title
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

  return (
    <Tabs defaultValue="source" className="w-full">
      <TabsList className="flex flex-wrap">
        <TabsTrigger value="source"><Inbox /> Mailbox Monitoring</TabsTrigger>
        <TabsTrigger value="polling"><Clock /> Polling</TabsTrigger>
        <TabsTrigger value="email"><Send /> Notifications</TabsTrigger>
        <TabsTrigger value="geoip"><Globe /> GeoIP</TabsTrigger>
        <TabsTrigger value="branding"><Palette /> Branding</TabsTrigger>
        <TabsTrigger value="backup"><DatabaseBackup /> Backup</TabsTrigger>
      </TabsList>

      {/* MAILBOX MONITORING */}
      <TabsContent value="source" className="pt-4">
        <SourceManager />
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display font-medium">Notifications</h2>
            <HelpLink href="/docs/notifications" />
          </div>
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display font-medium">GeoIP <span className="text-sm font-normal text-muted-foreground">(optional)</span></h2>
            <HelpLink href="/docs/geoip" />
          </div>
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
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display font-medium">White-label</h2>
              <HelpLink href="/docs/branding" />
            </div>
            <div><label className={labelCls}>Application name</label>
              <input className={input} value={f.brand_app_name} onChange={(e) => set("brand_app_name", e.target.value)} /></div>

            <div>
              <label className={labelCls}>Brand color</label>
              <p className="mb-2 text-xs text-muted-foreground">Drives buttons, active tabs, links, focus rings, and the logo. Set one per mode; button text auto-contrasts. The sidebar is always dark, so the logo uses the active mode&apos;s color.</p>
              <Tabs value={brandTab} onValueChange={(v) => setBrandTab((v as "light" | "dark") ?? "light")} className="w-full">
                <div className="flex items-center justify-between gap-3">
                  <TabsList>
                    <TabsTrigger value="light">Light mode</TabsTrigger>
                    <TabsTrigger value="dark">Dark mode</TabsTrigger>
                  </TabsList>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground" title={`Make ${brandTab} mode the default for new visitors`}>
                    Default to {brandTab} mode
                    <Switch checked={f.brand_default_theme === brandTab}
                      onChange={(v) => set("brand_default_theme", v ? brandTab : (brandTab === "light" ? "dark" : "light"))} />
                  </label>
                </div>
                <TabsContent value="light" className="pt-3">
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-10 w-12 rounded-md border" value={HEX_RE.test(f.brand_color_light) ? f.brand_color_light : "#0093a2"} onChange={(e) => set("brand_color_light", e.target.value)} />
                    <input className={input + " font-mono"} value={f.brand_color_light} onChange={(e) => set("brand_color_light", e.target.value)} />
                    <span className="rounded-md px-3 py-1.5 text-sm font-medium" style={{ background: HEX_RE.test(f.brand_color_light) ? f.brand_color_light : "#0093a2", color: previewText(f.brand_color_light) }}>Button</span>
                  </div>
                </TabsContent>
                <TabsContent value="dark" className="pt-3">
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-10 w-12 rounded-md border" value={HEX_RE.test(f.brand_color_dark) ? f.brand_color_dark : "#00df7e"} onChange={(e) => set("brand_color_dark", e.target.value)} />
                    <input className={input + " font-mono"} value={f.brand_color_dark} onChange={(e) => set("brand_color_dark", e.target.value)} />
                    <span className="rounded-md px-3 py-1.5 text-sm font-medium" style={{ background: HEX_RE.test(f.brand_color_dark) ? f.brand_color_dark : "#00df7e", color: previewText(f.brand_color_dark) }}>Button</span>
                  </div>
                </TabsContent>
              </Tabs>
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

      {/* BACKUP */}
      <TabsContent value="backup" className="pt-4">
        <BackupPanel />
      </TabsContent>
    </Tabs>
  );
}

function BackupPanel() {
  const [tab, setTab] = useState<"backup" | "restore">("backup");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab((v as "backup" | "restore") ?? "backup")} className="w-full">
      <TabsList>
        <TabsTrigger value="backup">Backup</TabsTrigger>
        <TabsTrigger value="restore">Restore</TabsTrigger>
      </TabsList>
      <TabsContent value="backup" className="pt-4"><BackupCard /></TabsContent>
      <TabsContent value="restore" className="pt-4"><RestoreCard /></TabsContent>
    </Tabs>
  );
}

function BackupCard() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Stream the zip via a blob so we can surface server-side errors (a plain anchor
  // would silently navigate to a JSON error page on failure).
  async function download() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/backup");
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `Backup failed (${r.status})`);
      }
      const blob = await r.blob();
      const cd = r.headers.get("Content-Disposition") || "";
      const name = /filename="([^"]+)"/.exec(cd)?.[1] || "dmarc-backup.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display font-medium">Backup</h2>
        <HelpLink href="/docs/backup-and-restore" />
      </div>
      <p className="text-sm text-muted-foreground">
        Download a single zip of the entire data folder: the database, the encryption key,
        the GeoIP database, and your branding assets. To move this dashboard to another server
        (a new Docker host, Easypanel, anywhere), unzip it into that instance&apos;s data folder
        before first start and everything comes across exactly as it is here.
      </p>
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-muted-foreground">
          This archive contains your encryption key and the encrypted mailbox credentials.
          Treat it like a password: store it somewhere private.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className={`inline-flex items-center gap-2 ${btnPrimary}`} onClick={download} disabled={busy}>
          <Download className="size-4" /> {busy ? "Preparing backup..." : "Download backup"}
        </button>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </div>
    </section>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
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

/* ---------- Multi-domain mailbox monitoring ---------- */

type Provider = "graph" | "imap";

interface Source {
  id: number;
  domain: string;
  provider: Provider;
  isActive: boolean;
  graphTenantId: string | null;
  graphClientId: string | null;
  mailboxUpn: string | null;
  imapHost: string | null;
  imapPort: number | null;
  imapUsername: string | null;
  imapTls: boolean | null;
  imapFolder: string | null;
  hasGraphSecret: boolean;
  hasImapPassword: boolean;
  lastPollAt: string | null;
  lastPollStatus: "ok" | "error" | null;
  lastPollDetail: string | null;
}

// Editable fields for a provider's credential form (shared by Edit + Add).
interface ProviderFields {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  mailboxUpn: string;
  imapHost: string;
  imapPort: string;
  imapUsername: string;
  imapPassword: string;
  imapTls: boolean;
  imapFolder: string;
}

const EMPTY_FIELDS: ProviderFields = {
  tenantId: "", clientId: "", clientSecret: "", mailboxUpn: "",
  imapHost: "", imapPort: "993", imapUsername: "", imapPassword: "", imapTls: true, imapFolder: "INBOX",
};

// Build the POST/PATCH body for a source from the shared field set.
// secretMode "omit-blank" leaves out unchanged secrets so the backend keeps the stored value.
function buildSourceBody(domain: string, provider: Provider, ff: ProviderFields) {
  const body: Record<string, unknown> = { domain: domain.trim(), provider };
  if (provider === "graph") {
    const graph: Record<string, unknown> = {
      tenantId: ff.tenantId.trim(), clientId: ff.clientId.trim(), mailboxUpn: ff.mailboxUpn.trim(),
    };
    if (ff.clientSecret.trim()) graph.clientSecret = ff.clientSecret;
    body.graph = graph;
  } else {
    const imap: Record<string, unknown> = {
      host: ff.imapHost.trim(), port: Number(ff.imapPort), username: ff.imapUsername.trim(),
      tls: ff.imapTls, folder: ff.imapFolder.trim() || "INBOX",
    };
    if (ff.imapPassword.trim()) imap.password = ff.imapPassword;
    body.imap = imap;
  }
  return body;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function SourceManager() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  async function reload() {
    try {
      const r = await fetch("/api/sources");
      const d = await r.json();
      setSources(Array.isArray(d) ? d : []);
      setLoaded(true);
    } catch {
      setErr("Failed to load monitored domains.");
      setLoaded(true);
    }
  }

  useEffect(() => { reload(); }, []);

  if (!loaded) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          The mailboxes monitored for DMARC reports. One source per domain: Microsoft 365 for Office 365, or IMAP for Gmail/Workspace and others.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <HelpLink href="/docs/mailbox/choosing-a-provider" />
          {!showAdd && (
            <button type="button" onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground">
              <Plus className="size-4" /> Add domain
            </button>
          )}
        </div>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {showAdd && <AddSourceCard onAdded={() => { setShowAdd(false); reload(); }} onCancel={() => setShowAdd(false)} />}

      {sources.length === 0 && !showAdd && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No monitored domains yet. Click &ldquo;Add domain&rdquo; to configure one.</p>
      )}

      {sources.map((s) => (
        <SourceCard key={s.id} source={s} onChanged={reload} />
      ))}
    </div>
  );
}

function providerLabel(p: Provider) { return p === "graph" ? "Microsoft 365" : "IMAP"; }

function SourceCard({ source, onChanged }: { source: Source; onChanged: () => void }) {
  const dialog = useDialog();
  const [editing, setEditing] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [saveMsg, setSaveMsg] = useState("");

  // Prefill the edit form from the source; secrets stay blank (placeholder explains).
  const [ff, setFf] = useState<ProviderFields>(() => ({
    ...EMPTY_FIELDS,
    tenantId: source.graphTenantId ?? "",
    clientId: source.graphClientId ?? "",
    mailboxUpn: source.mailboxUpn ?? "",
    imapHost: source.imapHost ?? "",
    imapPort: String(source.imapPort ?? 993),
    imapUsername: source.imapUsername ?? "",
    imapTls: source.imapTls ?? true,
    imapFolder: source.imapFolder ?? "INBOX",
  }));
  const [domain, setDomain] = useState(source.domain);

  async function test() {
    setTestMsg("Testing connection..."); setTestOk(null);
    try {
      const r = await fetch("/api/sources/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: source.id }),
      }).then((x) => x.json());
      setTestOk(!!r.ok);
      setTestMsg(r.ok ? "Connected: the mailbox is reachable." : `Connection failed: ${r.error}`);
    } catch { setTestOk(false); setTestMsg("Connection test failed to reach the server."); }
  }

  async function remove() {
    const ok = await dialog.confirm({
      title: "Remove domain",
      message: <>Stop monitoring <strong>{source.domain}</strong>? This stops polling and deletes its mailbox credentials.</>,
      confirmLabel: "Remove", destructive: true,
    });
    if (!ok) return;
    const r = await fetch(`/api/sources/${source.id}`, { method: "DELETE" });
    if (r.ok) onChanged(); else setSaveMsg("Failed to remove this domain.");
  }

  async function save() {
    if (!DOMAIN_RE.test(domain.trim())) { setSaveMsg("Enter a valid domain like example.com."); return; }
    setSaveMsg("Saving...");
    const r = await fetch(`/api/sources/${source.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSourceBody(domain, source.provider, ff)),
    });
    if (r.ok) { setEditing(false); onChanged(); }
    else { const d = await r.json().catch(() => ({})); setSaveMsg(d.error ? `Save failed: ${d.error}` : "Save failed."); }
  }

  const status = source.lastPollStatus;
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-medium text-lg">{source.domain}</h2>
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {source.provider === "graph" ? <Mail className="size-3.5" /> : <Server className="size-3.5" />}
              {providerLabel(source.provider)}
            </span>
          </div>
          <div className="text-sm">
            {status === "ok" && (
              <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <CheckCircle className="size-4" />
                <span className="font-medium">OK</span>
                <span className="text-muted-foreground">{source.lastPollDetail}{source.lastPollAt ? ` (${relativeTime(source.lastPollAt)})` : ""}</span>
              </span>
            )}
            {status === "error" && (
              <span className="inline-flex items-center gap-1.5 text-destructive">
                <AlertTriangle className="size-4" />
                <span className="font-medium">Error</span>
                <span className="text-muted-foreground">{source.lastPollDetail}</span>
              </span>
            )}
            {!status && <span className="text-muted-foreground">Not polled yet</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={`inline-flex items-center gap-1.5 ${btnGhost}`} onClick={() => setEditing((v) => !v)}>
            <Pencil className="size-4" /> {editing ? "Close" : "Edit"}
          </button>
          <button type="button" className={btnGhost} onClick={test}>Test connection</button>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/50 px-3.5 py-2 text-sm font-medium text-destructive hover:bg-destructive/10" onClick={remove}>
            <Trash2 className="size-4" /> Remove
          </button>
        </div>
      </div>

      {testMsg && <p className={`text-sm ${testOk === false ? "text-destructive" : testOk ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>{testMsg}</p>}

      {editing && (
        <div className="space-y-3 border-t pt-4">
          <div><label className={labelCls}>Domain</label>
            <input className={input} placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} /></div>
          <ProviderFieldset provider={source.provider} ff={ff} setFf={setFf} editing />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btnPrimary} onClick={save}>Save changes</button>
            {saveMsg && <p className="text-sm">{saveMsg}</p>}
          </div>
        </div>
      )}
      {!editing && saveMsg && <p className="text-sm">{saveMsg}</p>}
    </section>
  );
}

function AddSourceCard({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [domain, setDomain] = useState("");
  const [provider, setProvider] = useState<Provider>("graph");
  const [ff, setFf] = useState<ProviderFields>(EMPTY_FIELDS);
  const [msg, setMsg] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [testOk, setTestOk] = useState<boolean | null>(null);

  function reset() {
    setDomain(""); setProvider("graph"); setFf(EMPTY_FIELDS); setMsg(""); setTestMsg(""); setTestOk(null);
  }

  async function test() {
    setTestMsg("Testing connection..."); setTestOk(null);
    const body = buildSourceBody(domain || "test.local", provider, ff);
    delete body.domain;
    try {
      const r = await fetch("/api/sources/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((x) => x.json());
      setTestOk(!!r.ok);
      setTestMsg(r.ok ? "Connected: the mailbox is reachable." : `Connection failed: ${r.error}`);
    } catch { setTestOk(false); setTestMsg("Connection test failed to reach the server."); }
  }

  async function add() {
    if (!DOMAIN_RE.test(domain.trim())) { setMsg("Enter a valid domain like example.com."); return; }
    setMsg("Adding...");
    const r = await fetch("/api/sources", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSourceBody(domain, provider, ff)),
    });
    if (r.ok) { reset(); onAdded(); }
    else { const d = await r.json().catch(() => ({})); setMsg(d.error ? `Could not add: ${d.error}` : "Could not add this domain."); }
  }

  return (
    <section className={`${card} border-dashed`}>
      <div><label className={labelCls}>Domain</label>
        <input className={input} placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} /></div>

      <div>
        <label className={labelCls}>Provider</label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => { setProvider("graph"); setTestMsg(""); setTestOk(null); }}
            className={`relative flex flex-col gap-1 rounded-2xl border p-4 text-left transition ${provider === "graph" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}>
            {provider === "graph" && <CheckCircle className="absolute right-3 top-3 size-4 text-primary" />}
            <Mail className="size-5 text-primary" />
            <span className="font-medium">Microsoft 365 (Graph)</span>
            <span className="text-xs text-muted-foreground">Azure app registration with Mail.ReadWrite.</span>
          </button>
          <button type="button" onClick={() => { setProvider("imap"); setTestMsg(""); setTestOk(null); }}
            className={`relative flex flex-col gap-1 rounded-2xl border p-4 text-left transition ${provider === "imap" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}>
            {provider === "imap" && <CheckCircle className="absolute right-3 top-3 size-4 text-primary" />}
            <Server className="size-5 text-primary" />
            <span className="font-medium">IMAP (Gmail, Workspace, other)</span>
            <span className="text-xs text-muted-foreground">Standard IMAP with an app password.</span>
          </button>
        </div>
      </div>

      <ProviderFieldset provider={provider} ff={ff} setFf={setFf} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnPrimary} onClick={add}>Add domain</button>
        <button type="button" className={btnGhost} onClick={test}>Test connection</button>
        <button type="button" className={btnGhost} onClick={() => { reset(); onCancel(); }}>Cancel</button>
      </div>
      {testMsg && <p className={`text-sm ${testOk === false ? "text-destructive" : testOk ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>{testMsg}</p>}
      {msg && <p className="text-sm">{msg}</p>}
    </section>
  );
}

// Shared credential fields for a provider, used in both Add and Edit.
// When `editing`, secret inputs render blank with a "leave blank to keep current" hint.
function ProviderFieldset({ provider, ff, setFf, editing }: {
  provider: Provider;
  ff: ProviderFields;
  setFf: Dispatch<SetStateAction<ProviderFields>>;
  editing?: boolean;
}) {
  const upd = <K extends keyof ProviderFields>(k: K, v: ProviderFields[K]) => setFf((s) => ({ ...s, [k]: v }));
  if (provider === "graph") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">App-only access to a 365 mailbox. See docs/SETUP-ENTRA.md for the one-time Entra app registration.</p>
        <div><label className={labelCls}>Tenant ID</label>
          <input className={input} value={ff.tenantId} onChange={(e) => upd("tenantId", e.target.value)} /></div>
        <div><label className={labelCls}>Client ID</label>
          <input className={input} value={ff.clientId} onChange={(e) => upd("clientId", e.target.value)} /></div>
        <div><label className={labelCls}>Client secret</label>
          <input className={input} type="password" placeholder={editing ? "leave blank to keep current" : ""} value={ff.clientSecret} onChange={(e) => upd("clientSecret", e.target.value)} /></div>
        <div><label className={labelCls}>Mailbox (UPN)</label>
          <input className={input} placeholder="dmarc@yourdomain.com" value={ff.mailboxUpn} onChange={(e) => upd("mailboxUpn", e.target.value)} /></div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Gmail/Workspace need an app password (with 2FA). Host examples: imap.gmail.com:993, imap.fastmail.com:993.</p>
      <div><label className={labelCls}>Host</label>
        <input className={input} placeholder="imap.gmail.com" value={ff.imapHost} onChange={(e) => upd("imapHost", e.target.value)} /></div>
      <div><label className={labelCls}>Port</label>
        <input className={input} type="number" min={1} max={65535} value={ff.imapPort} onChange={(e) => upd("imapPort", e.target.value)} /></div>
      <div><label className={labelCls}>Username</label>
        <input className={input} placeholder="dmarc@yourdomain.com" value={ff.imapUsername} onChange={(e) => upd("imapUsername", e.target.value)} /></div>
      <div><label className={labelCls}>Password (app password)</label>
        <input className={input} type="password" placeholder={editing ? "leave blank to keep current" : ""} value={ff.imapPassword} onChange={(e) => upd("imapPassword", e.target.value)} /></div>
      <div><label className={labelCls}>Encryption</label>
        <select className={input} value={ff.imapTls ? "tls" : "plain"} onChange={(e) => upd("imapTls", e.target.value === "tls")}>
          <option value="tls">TLS / SSL (recommended)</option>
          <option value="plain">None</option>
        </select></div>
      <div><label className={labelCls}>Folder</label>
        <input className={input} value={ff.imapFolder} onChange={(e) => upd("imapFolder", e.target.value)} /></div>
    </div>
  );
}
