export function BreakdownBar({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <div className="w-40 truncate text-sm">{r.label}</div>
          <div className="h-4 flex-1 rounded bg-muted">
            <div className="h-4 rounded bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <div className="w-16 text-right text-sm tabular-nums">{r.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
