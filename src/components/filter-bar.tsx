"use client";
import { useRouter, useSearchParams } from "next/navigation";

export function FilterBar({ domains }: { domains: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push("?" + next.toString());
  }
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <label className="text-sm text-muted-foreground">Domain
        <select className="ml-2 rounded-md border border-border bg-background px-2 py-1 text-foreground" defaultValue={params.get("domain") ?? ""}
          onChange={(e) => setParam("domain", e.target.value)}>
          <option value="">All</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
      <label className="text-sm text-muted-foreground">From
        <input type="date" className="ml-2 rounded-md border border-border bg-background px-2 py-1 text-foreground" defaultValue={params.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)} />
      </label>
      <label className="text-sm text-muted-foreground">To
        <input type="date" className="ml-2 rounded-md border border-border bg-background px-2 py-1 text-foreground" defaultValue={params.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)} />
      </label>
    </div>
  );
}
