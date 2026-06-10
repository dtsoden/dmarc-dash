"use client";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { PollNowButton } from "./poll-now-button";
import { HelpLink } from "./help-link";
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

export function AppHeader({ role }: { role: Role }) {
  const path = usePathname();
  const title = TITLES[path] ?? (path.startsWith("/reports/") ? "Report detail" : "Dashboard");
  const canPoll = role === "admin" || role === "analyst";
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur-md">
      <h1 className="font-display text-lg font-semibold tracking-tight">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        {canPoll && <PollNowButton />}
        <HelpLink href="/docs" />
        <ThemeToggle />
      </div>
    </header>
  );
}
