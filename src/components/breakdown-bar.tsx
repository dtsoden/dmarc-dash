export function BreakdownBar({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const fill = (label: string) => {
    switch (label.toLowerCase()) {
      case "pass": return "bg-emerald-500";
      case "quarantine": return "bg-amber-500";
      case "reject": return "bg-red-500";
      case "none": return "bg-muted-foreground/40";
      default: return "bg-primary";
    }
  };
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <div className="w-40 truncate text-sm font-medium capitalize">{r.label}</div>
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted">
            <div className={`h-4 rounded-full ${fill(r.label)}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <div className="w-16 text-right text-sm tabular-nums">{r.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
