"use client";
import { useEffect, useState } from "react";

interface SettingsState {
  graph_tenant_id: string;
  graph_client_id: string;
  graph_client_secret: string;
  mailbox_upn: string;
  poll_interval_minutes: number;
  delete_mode: string;
  mailersend_token: string;
  mailersend_from: string;
  digest_recipients: string; // comma-separated in the form
  digest_weekly_cron: string;
  digest_monthly_cron: string;
  maxmind_license_key: string;
}

const EMPTY: SettingsState = {
  graph_tenant_id: "", graph_client_id: "", graph_client_secret: "", mailbox_upn: "",
  poll_interval_minutes: 15, delete_mode: "safe",
  mailersend_token: "", mailersend_from: "", digest_recipients: "",
  digest_weekly_cron: "", digest_monthly_cron: "", maxmind_license_key: "",
};

const input = "w-full rounded-md border px-3 py-2";

export function SettingsForm() {
  const [f, setF] = useState<SettingsState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");

  const set = <K extends keyof SettingsState>(k: K, v: SettingsState[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const recipients = Array.isArray(d.digest_recipients) ? d.digest_recipients.join(", ") : "";
        setF({
          graph_tenant_id: d.graph_tenant_id ?? "",
          graph_client_id: d.graph_client_id ?? "",
          graph_client_secret: d.graph_client_secret ?? "",
          mailbox_upn: d.mailbox_upn ?? "",
          poll_interval_minutes: Number(d.poll_interval_minutes ?? 15),
          delete_mode: d.delete_mode ?? "safe",
          mailersend_token: d.mailersend_token ?? "",
          mailersend_from: d.mailersend_from ?? "",
          digest_recipients: recipients,
          digest_weekly_cron: d.digest_weekly_cron ?? "",
          digest_monthly_cron: d.digest_monthly_cron ?? "",
          maxmind_license_key: d.maxmind_license_key ?? "",
        });
        setLoaded(true);
      })
      .catch(() => setMsg("Failed to load settings"));
  }, []);

  async function save() {
    setMsg("Saving...");
    const body = {
      ...f,
      poll_interval_minutes: Number(f.poll_interval_minutes),
      digest_recipients: f.digest_recipients.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setMsg(r.ok ? "Saved" : "Save failed");
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border bg-background p-6">
        <h2 className="font-medium">Microsoft Graph</h2>
        <label className="block text-sm">Tenant ID
          <input className={input} value={f.graph_tenant_id} onChange={(e) => set("graph_tenant_id", e.target.value)} /></label>
        <label className="block text-sm">Client ID
          <input className={input} value={f.graph_client_id} onChange={(e) => set("graph_client_id", e.target.value)} /></label>
        <label className="block text-sm">Client secret
          <input className={input} type="password" value={f.graph_client_secret} onChange={(e) => set("graph_client_secret", e.target.value)} /></label>
        <label className="block text-sm">Mailbox (UPN)
          <input className={input} value={f.mailbox_upn} onChange={(e) => set("mailbox_upn", e.target.value)} /></label>
      </section>

      <section className="space-y-3 rounded-xl border bg-background p-6">
        <h2 className="font-medium">Polling</h2>
        <label className="block text-sm">Check interval (minutes)
          <input className={input} type="number" min={1} value={f.poll_interval_minutes}
            onChange={(e) => set("poll_interval_minutes", Number(e.target.value))} /></label>
        <label className="block text-sm">On parse failure
          <select className={input} value={f.delete_mode} onChange={(e) => set("delete_mode", e.target.value)}>
            <option value="safe">Move email to DMARC-Errors (safe)</option>
            <option value="hard">Delete email anyway (hard)</option>
          </select></label>
      </section>

      <section className="space-y-3 rounded-xl border bg-background p-6">
        <h2 className="font-medium">Email digests</h2>
        <label className="block text-sm">MailerSend API token
          <input className={input} type="password" value={f.mailersend_token} onChange={(e) => set("mailersend_token", e.target.value)} /></label>
        <label className="block text-sm">From address
          <input className={input} value={f.mailersend_from} onChange={(e) => set("mailersend_from", e.target.value)} /></label>
        <label className="block text-sm">Recipients (comma-separated)
          <input className={input} value={f.digest_recipients} onChange={(e) => set("digest_recipients", e.target.value)} /></label>
        <div className="flex gap-2">
          <label className="block flex-1 text-sm">Weekly cron
            <input className={input} value={f.digest_weekly_cron} onChange={(e) => set("digest_weekly_cron", e.target.value)} /></label>
          <label className="block flex-1 text-sm">Monthly cron
            <input className={input} value={f.digest_monthly_cron} onChange={(e) => set("digest_monthly_cron", e.target.value)} /></label>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-background p-6">
        <h2 className="font-medium">GeoIP</h2>
        <label className="block text-sm">MaxMind GeoLite2 license key
          <input className={input} type="password" value={f.maxmind_license_key} onChange={(e) => set("maxmind_license_key", e.target.value)} /></label>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" className="rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={save}>Save</button>
        {msg && <p className="text-sm">{msg}</p>}
      </div>
    </div>
  );
}
