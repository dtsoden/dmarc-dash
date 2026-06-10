"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function PollNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/poll/run", { method: "POST" }).then((x) => x.json());
      const res = r.result ?? {};
      if (res.skipped) setMsg("Already running");
      else if (res.error) setMsg("Error");
      else setMsg(`+${res.ingested ?? 0} ingested${res.skipped ? "" : ""}`);
      router.refresh();
    } catch { setMsg("Failed"); }
    finally { setBusy(false); setTimeout(() => setMsg(""), 6000); }
  }
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <button onClick={run} disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60">
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Polling" : "Poll now"}
      </button>
    </div>
  );
}
