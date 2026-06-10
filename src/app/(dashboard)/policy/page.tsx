import { bootstrap } from "@/lib/config";
import { dispositionBreakdown, listDomains } from "@/lib/db/queries";
import { parseFilters } from "@/lib/filters";
import { BreakdownBar } from "@/components/breakdown-bar";
import { FilterBar } from "@/components/filter-bar";

export const dynamic = "force-dynamic";

export default async function PolicyPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const dbPath = bootstrap().dbPath;
  const d = dispositionBreakdown(dbPath, parseFilters(sp));
  const domains = listDomains(dbPath);
  return (
    <div>
      <FilterBar domains={domains} />
      <div className="rounded-xl border bg-background p-4">
        <h2 className="mb-4 text-sm font-medium">Disposition breakdown</h2>
        <BreakdownBar rows={d.map((r) => ({ label: r.disposition, value: r.messages }))} />
      </div>
    </div>
  );
}
