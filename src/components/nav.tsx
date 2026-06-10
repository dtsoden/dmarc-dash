"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/lib/auth/session";

const baseLinks = [
  { href: "/", label: "Overview" },
  { href: "/sources", label: "Sources" },
  { href: "/authentication", label: "Authentication" },
  { href: "/policy", label: "Policy" },
  { href: "/reports", label: "Reports" },
  { href: "/ingest-log", label: "Ingest Log" },
];
const adminLinks = [
  { href: "/settings", label: "Settings" },
  { href: "/users", label: "Users" },
];

export function Nav({ role, username }: { role: Role; username?: string }) {
  const path = usePathname();
  const router = useRouter();
  const links = role === "admin" ? [...baseLinks, ...adminLinks] : baseLinks;
  const canPoll = role === "admin" || role === "analyst";
  const [polling, setPolling] = useState(false);
  const [pollMsg, setPollMsg] = useState("");

  async function pollNow() {
    setPolling(true); setPollMsg("");
    try {
      const r = await fetch("/api/poll/run", { method: "POST" }).then((x) => x.json());
      const res = r.result ?? {};
      if (res.skipped) setPollMsg("A poll is already running.");
      else if (res.error) setPollMsg(`Error: ${res.error}`);
      else setPollMsg(`Done: ${res.ingested ?? 0} ingested, ${res.duplicates ?? 0} dup, ${res.failed ?? 0} failed.`);
      router.refresh(); // reload server components so the dashboards show new data
    } catch {
      setPollMsg("Poll request failed.");
    } finally {
      setPolling(false);
    }
  }

  return (
    <nav className="flex items-center gap-1 text-sm">
      {links.map((l) => (
        <Link key={l.href} href={l.href}
          className={`rounded-md px-3 py-1.5 ${path === l.href ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          {l.label}
        </Link>
      ))}
      {canPoll && (
        <button type="button" onClick={pollNow} disabled={polling}
          title={pollMsg || "Run the mailbox poll now"}
          className="ml-2 rounded-md border px-3 py-1.5 hover:bg-muted disabled:opacity-50">
          {polling ? "Polling..." : "Poll now"}
        </button>
      )}
      {pollMsg && <span className="max-w-xs truncate text-xs text-muted-foreground" title={pollMsg}>{pollMsg}</span>}
      <span className="ml-2 text-xs text-muted-foreground">{username} ({role})</span>
      <button className="rounded-md px-3 py-1.5 hover:bg-muted" type="button"
        onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(() => location.assign("/login"))}>
        Sign out
      </button>
    </nav>
  );
}
