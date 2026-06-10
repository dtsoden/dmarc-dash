import { BookOpen } from "lucide-react";

// A consistent "docs" affordance that opens the bundled documentation in a new tab.
// variant "primary" = filled with the brand color (used on in-page sections);
// variant "subtle" = bordered/muted (used in the header alongside icon buttons).
export function HelpLink({
  href, label = "Docs", variant = "primary", className = "",
}: {
  href: string;
  label?: string;
  variant?: "primary" | "subtle";
  className?: string;
}) {
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${styles} ${className}`}
    >
      <BookOpen className="size-3.5" /> {label}
    </a>
  );
}
