"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { PAGE_SIZES } from "@/lib/table-params";

export interface ToolbarFilter { key: string; label: string; options: { value: string; label: string }[] }

export function TableToolbar({ searchPlaceholder = "Search...", filters = [] }: { searchPlaceholder?: string; filters?: ToolbarFilter[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  function setParam(k: string, v: string) {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v); else n.delete(k);
    n.delete("page"); // any filter change resets to page 1
    router.push("?" + n.toString());
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input defaultValue={sp.get("q") ?? ""} placeholder={searchPlaceholder}
          onKeyDown={(e) => { if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value.trim()); }}
          className="w-60 rounded-md border bg-background py-2 pl-8 pr-3 text-sm" />
      </div>
      {filters.map((f) => (
        <select key={f.key} defaultValue={sp.get(f.key) ?? ""} onChange={(e) => setParam(f.key, e.target.value)}
          className="rounded-md border bg-background px-2 py-2 text-sm">
          <option value="">{f.label}</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      <select defaultValue={sp.get("pageSize") ?? "25"} onChange={(e) => setParam("pageSize", e.target.value)}
        className="ml-auto rounded-md border bg-background px-2 py-2 text-sm">
        {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
      </select>
    </div>
  );
}
