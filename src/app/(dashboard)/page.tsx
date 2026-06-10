import { bootstrap } from "@/lib/config";
import { overviewKpis, volumeByDay, listDomains } from "@/lib/db/queries";
import { parseFilters } from "@/lib/filters";
import { KpiCard } from "@/components/kpi-card";
import { VolumeChart } from "@/components/volume-chart";
import { FilterBar } from "@/components/filter-bar";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const dbPath = bootstrap().dbPath;
  const f = parseFilters(sp);
  const k = overviewKpis(dbPath, f);
  const volume = volumeByDay(dbPath, f);
  const domains = listDomains(dbPath);
  const pct = (n: number) => k.totalMessages ? `${Math.round((n / k.totalMessages) * 100)}%` : "0%";

  return (
    <div>
      <FilterBar domains={domains} />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard title="Total messages" value={k.totalMessages.toLocaleString()} />
        <KpiCard title="DMARC pass" value={pct(k.dmarcPass)} sub={`${k.dmarcPass.toLocaleString()} msgs`} />
        <KpiCard title="SPF pass" value={pct(k.spfPass)} />
        <KpiCard title="DKIM pass" value={pct(k.dkimPass)} />
        <KpiCard title="Quarantined" value={k.quarantined.toLocaleString()} />
        <KpiCard title="Rejected" value={k.rejected.toLocaleString()} />
        <KpiCard title="Sending sources" value={k.distinctSources.toLocaleString()} />
      </div>
      <div className="rounded-xl border bg-background p-4">
        <h2 className="mb-4 text-sm font-medium">Volume by day</h2>
        <VolumeChart data={volume} />
      </div>
    </div>
  );
}
