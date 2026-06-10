"use client";
import { useRef, useState } from "react";
import { Upload, ShieldAlert, RotateCcw, FileArchive } from "lucide-react";
import { HelpLink } from "@/components/help-link";

// Shared restore control used in Settings (Backup -> Restore) and in the setup wizard
// (restoring straight into a fresh instance). Uploads a backup zip to /api/restore,
// which overwrites the data volume and restarts the process; we then poll until the
// container is back and send the user to the login screen (the session cookie is
// signed with the now-replaced encryption key, so a fresh login is required).

type Status = "idle" | "uploading" | "restarting" | "error";

export function RestoreCard({ className = "" }: { className?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [err, setErr] = useState("");

  const busy = status === "uploading" || status === "restarting";

  async function waitForRestart() {
    // Give the process a moment to actually exit before we start polling, so we don't
    // get a false "up" from the instance that is about to die.
    await new Promise((r) => setTimeout(r, 3000));
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        if (r.ok) return true;
      } catch { /* still restarting */ }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  }

  async function restore() {
    if (!file) return;
    setConfirming(false);
    setStatus("uploading"); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/restore", { method: "POST", body: fd });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `Restore failed (${r.status})`);
      }
      setStatus("restarting");
      await waitForRestart();
      // Whether or not the poll confirmed, the old session is invalid now; go to login.
      // Use a unique, cache-busting URL so the browser fetches a freshly rendered page
      // instead of serving the pre-restore HTML from cache. The theme (light/dark) and
      // brand colors are baked into the server-rendered markup from the database, so a
      // cached page would show the old instance's theme until a manual hard refresh.
      window.location.replace(`/login?restored=${Date.now()}`);
    } catch (e) {
      setStatus("error");
      setErr(e instanceof Error ? e.message : "Restore failed");
    }
  }

  if (status === "restarting") {
    return (
      <div className={`flex items-center gap-3 rounded-2xl border border-border bg-card p-6 ${className}`}>
        <RotateCcw className="size-5 shrink-0 animate-spin text-primary" />
        <div>
          <p className="font-medium">Restoring and restarting...</p>
          <p className="text-sm text-muted-foreground">The dashboard is coming back up with your restored data. You will be sent to the login screen.</p>
        </div>
      </div>
    );
  }

  return (
    <section className={`space-y-4 rounded-2xl border border-border bg-card p-6 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display font-medium">Restore from backup</h2>
        <HelpLink href="/docs/backup-and-restore" />
      </div>
      <p className="text-sm text-muted-foreground">
        Upload a backup zip to rebuild this instance from it: database, encryption key, GeoIP
        database, and branding. This is how you clone an existing dashboard onto a fresh server,
        unzip a backup straight into a blank instance and it becomes an exact copy.
      </p>

      <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p className="text-muted-foreground">
          This <span className="font-medium text-foreground">overwrites everything</span> in this
          instance with the contents of the backup, then restarts. Any data here that is not in
          the backup is lost, and you will sign in with the credentials from the backup.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setConfirming(false); setStatus("idle"); setErr(""); e.target.value = ""; }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} className="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm disabled:opacity-60" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" /> Choose backup file
        </button>
        {file && (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileArchive className="size-4" /> {file.name}
          </span>
        )}
      </div>

      {file && !confirming && (
        <button type="button" disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 px-3.5 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
          onClick={() => setConfirming(true)}>
          <RotateCcw className="size-4" /> Restore and restart
        </button>
      )}

      {confirming && (
        <div className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <p className="text-sm font-medium">Overwrite this instance with <span className="font-mono">{file?.name}</span> and restart?</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={busy}
              className="rounded-lg bg-destructive px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={restore}>
              {status === "uploading" ? "Uploading..." : "Yes, restore"}
            </button>
            <button type="button" disabled={busy} className="rounded-lg border px-3.5 py-2 text-sm" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}

      {err && <p className="text-sm text-destructive">{err}</p>}
    </section>
  );
}
