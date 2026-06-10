"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Globe2, ShieldCheck, Gavel, FileText, ScrollText, Network, Settings, Users, LogOut } from "lucide-react";
import type { Role } from "@/lib/auth/session";

const groups = [
  { label: "Monitoring", items: [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/sources", label: "Sources", icon: Globe2 },
    { href: "/authentication", label: "Authentication", icon: ShieldCheck },
    { href: "/policy", label: "Policy", icon: Gavel },
  ]},
  { label: "Reports", items: [
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/dns", label: "DNS Report", icon: Network },
    { href: "/ingest-log", label: "Ingest Log", icon: ScrollText },
  ]},
];
const adminGroup = { label: "Administration", items: [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/users", label: "Users", icon: Users },
]};

export function AppSidebar({ role, username, appName, logoExt }: { role: Role; username?: string; appName: string; logoExt: string }) {
  const path = usePathname();
  const navGroups = role === "admin" ? [...groups, adminGroup] : groups;
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <aside className="sticky top-0 hidden h-screen w-[256px] shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.04] to-transparent" />
      <div className="relative flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        {logoExt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/api/brand/logo" alt={appName} className="h-8 w-auto max-w-[170px] object-contain" />
        ) : (
          <>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight text-white">{appName}</span>
          </>
        )}
      </div>

      <nav className="relative flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navGroups.map((g) => (
          <div key={g.label}>
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/45">{g.label}</div>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const active = isActive(it.href);
                const Icon = it.icon;
                return (
                  <Link key={it.href} href={it.href}
                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-sidebar-accent font-medium text-white" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"}`}>
                    {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-brand-accent" />}
                    <Icon className={`h-[18px] w-[18px] ${active ? "text-brand-accent" : "text-sidebar-foreground/70 group-hover:text-white"}`} />
                    {it.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="relative border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-accent text-xs font-semibold uppercase text-white">{(username || "?").slice(0, 2)}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-white">{username}</div>
            <div className="text-[11px] capitalize text-sidebar-foreground/55">{role}</div>
          </div>
          <button onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(() => location.assign("/login"))}
            title="Sign out" className="rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
