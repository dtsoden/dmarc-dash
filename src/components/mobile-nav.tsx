"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X, ShieldCheck, LogOut, BookOpen } from "lucide-react";
import type { Role } from "@/lib/auth/session";
import { navGroupsForRole, isNavActive } from "./nav-model";

// Mobile navigation: a hamburger button (shown only below md, where the sidebar is
// hidden) that opens a slide-in drawer with the same nav as the desktop sidebar. The
// Docs link lives here on mobile, where the header has no room for it.
//
// The drawer is rendered via a portal into document.body. It must NOT live inside the
// header: the header uses backdrop-blur, and a backdrop-filter establishes a containing
// block for fixed-position descendants, which would trap the "fixed inset-0" drawer
// inside the 64px header bar instead of covering the viewport.
export function MobileNav({ role, username, appName, logoExt }: { role: Role; username?: string; appName: string; logoExt: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const navGroups = navGroupsForRole(role);

  useEffect(() => setMounted(true), []);

  // Close on navigation (the layout persists across route changes, so the drawer would
  // otherwise stay open after a link click).
  useEffect(() => { setOpen(false); }, [path]);

  // Esc to close and lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  const drawer = (
    <div className="fixed inset-0 z-[60] md:hidden">
      <button type="button" aria-label="Close menu" tabIndex={-1}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <aside className="absolute left-0 top-0 flex h-full w-[270px] max-w-[82vw] flex-col bg-sidebar text-sidebar-foreground shadow-2xl">
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
          {logoExt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/brand/logo" alt={appName} className="h-8 w-auto max-w-[150px] object-contain" />
          ) : (
            <>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="font-display text-[15px] font-bold tracking-tight text-white">{appName}</span>
            </>
          )}
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)}
            className="ml-auto grid size-9 place-items-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {navGroups.map((g) => (
            <div key={g.label}>
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/45">{g.label}</div>
              <div className="space-y-0.5">
                {g.items.map((it) => {
                  const active = isNavActive(path, it.href);
                  const Icon = it.icon;
                  return (
                    <Link key={it.href} href={it.href} onClick={() => setOpen(false)}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? "bg-sidebar-accent font-medium text-white" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"}`}>
                      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-brand-accent" />}
                      <Icon className={`h-[18px] w-[18px] ${active ? "text-brand-accent" : "text-sidebar-foreground/70 group-hover:text-white"}`} />
                      {it.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/45">Help</div>
            <a href="/docs" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white">
              <BookOpen className="h-[18px] w-[18px] text-sidebar-foreground/70 group-hover:text-white" /> Documentation
            </a>
          </div>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sidebar-accent text-xs font-semibold uppercase text-white">{(username || "?").slice(0, 2)}</span>
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
    </div>
  );

  return (
    <>
      <button type="button" aria-label="Open menu" onClick={() => setOpen(true)}
        className="-ml-1 grid size-9 shrink-0 place-items-center rounded-lg text-foreground hover:bg-muted md:hidden">
        <Menu className="size-5" />
      </button>
      {open && mounted && createPortal(drawer, document.body)}
    </>
  );
}
