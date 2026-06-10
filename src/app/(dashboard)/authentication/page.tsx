import { bootstrap } from "@/lib/config";
import { authQuadrant, listDomains } from "@/lib/db/queries";
import { parseFilters } from "@/lib/filters";
import { KpiCard } from "@/components/kpi-card";
import { FilterBar } from "@/components/filter-bar";

export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const dbPath = bootstrap().dbPath;
  const q = authQuadrant(dbPath, parseFilters(sp));
  const domains = listDomains(dbPath);
  return (
    <div>
      <FilterBar domains={domains} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard title="SPF + DKIM" value={q.both.toLocaleString()} />
        <KpiCard title="DKIM only" value={q.dkimOnly.toLocaleString()} />
        <KpiCard title="SPF only" value={q.spfOnly.toLocaleString()} />
        <KpiCard title="Neither" value={q.neither.toLocaleString()} />
      </div>
    </div>
  );
}
