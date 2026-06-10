"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const links = role === "admin" ? [...baseLinks, ...adminLinks] : baseLinks;
  return (
    <nav className="flex items-center gap-1 text-sm">
      {links.map((l) => (
        <Link key={l.href} href={l.href}
          className={`rounded-md px-3 py-1.5 ${path === l.href ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          {l.label}
        </Link>
      ))}
      <span className="ml-2 text-xs text-muted-foreground">{username} ({role})</span>
      <button className="rounded-md px-3 py-1.5 hover:bg-muted" type="button"
        onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(() => location.assign("/login"))}>
        Sign out
      </button>
    </nav>
  );
}
