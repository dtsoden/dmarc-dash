"use client";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { PollNowButton } from "./poll-now-button";
import { HelpLink } from "./help-link";
import { MobileNav } from "./mobile-nav";
import type { Role } from "@/lib/auth/session";

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/sources": "Sources",
  "/authentication": "Authentication",
  "/policy": "Policy",
  "/reports": "Reports",
  "/dns": "DNS Report",
  "/ingest-log": "Ingest Log",
  "/settings": "Settings",
  "/users": "Users",
};

export function AppHeader({ role, username, appName, logoExt }: { role: Role; username?: string; appName: string; logoExt: string }) {
  const path = usePathname();
  const title = TITLES[path] ?? (path.startsWith("/reports/") ? "Report detail" : "Dashboard");
  const canPoll = role === "admin" || role === "analyst";
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:gap-3 sm:px-6">
      <MobileNav role={role} username={username} appName={appName} logoExt={logoExt} />
      <h1 className="min-w-0 truncate font-display text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        {canPoll && <PollNowButton />}
        {/* The sidebar carries Docs on desktop; on mobile it lives in the drawer, so the
            header link only appears once the sidebar is visible (md and up). */}
        <span className="hidden md:inline-flex"><HelpLink href="/docs" variant="subtle" /></span>
        <ThemeToggle />
      </div>
    </header>
  );
}
