import { BookOpen } from "lucide-react";

// A small "docs" affordance that opens the bundled documentation in a new tab.
export function HelpLink({ href, label = "Docs", className = "" }: { href: string; label?: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${className}`}
    >
      <BookOpen className="size-3.5" /> {label}
    </a>
  );
}
