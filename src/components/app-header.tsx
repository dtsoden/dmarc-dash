"use client";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { PollNowButton } from "./poll-now-button";
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
        <a href="/docs" target="_blank" rel="noopener noreferrer" title="Documentation"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground">
          <BookOpen className="size-[18px]" />
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
