import type { ReactNode } from "react";

export function KpiCard({
  title, value, sub, icon, accent = "default", index = 0,
}: {
  title: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  accent?: "default" | "good" | "bad" | "warn";
  index?: number;
}) {
  const ring: Record<string, string> = {
    default: "text-primary",
    good: "text-emerald-500",
    bad: "text-red-500",
    warn: "text-amber-500",
  };
  return (
    <div
      className="card-elev animate-rise group relative overflow-hidden rounded-2xl border border-border bg-card p-5"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">{title}</span>
        {icon && <span className={`opacity-70 ${ring[accent]}`}>{icon}</span>}
      </div>
      <div className="mt-3 font-display text-3xl font-bold tracking-tight tabular-nums">{value}</div>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      <span className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-[0.10] ${accent === "good" ? "bg-emerald-500" : accent === "bad" ? "bg-red-500" : accent === "warn" ? "bg-amber-500" : "bg-primary"}`} />
    </div>
  );
}
