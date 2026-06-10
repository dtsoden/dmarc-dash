import { bootstrap } from "@/lib/config";
import { overviewKpis, volumeByDay, listDomains } from "@/lib/db/queries";
import { parseFilters } from "@/lib/filters";
import { KpiCard } from "@/components/kpi-card";
import { VolumeChart } from "@/components/volume-chart";
import { FilterBar } from "@/components/filter-bar";
import { Mail, ShieldCheck, KeyRound, ShieldAlert, ShieldX, Server } from "lucide-react";

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
        <KpiCard title="Total messages" value={k.totalMessages.toLocaleString()} icon={<Mail className="h-4 w-4" />} index={0} />
        <KpiCard title="DMARC pass" value={pct(k.dmarcPass)} sub={`${k.dmarcPass.toLocaleString()} msgs`} icon={<ShieldCheck className="h-4 w-4" />} accent="good" index={1} />
        <KpiCard title="SPF pass" value={pct(k.spfPass)} icon={<ShieldCheck className="h-4 w-4" />} accent="good" index={2} />
        <KpiCard title="DKIM pass" value={pct(k.dkimPass)} icon={<KeyRound className="h-4 w-4" />} accent="good" index={3} />
        <KpiCard title="Quarantined" value={k.quarantined.toLocaleString()} icon={<ShieldAlert className="h-4 w-4" />} accent="warn" index={4} />
        <KpiCard title="Rejected" value={k.rejected.toLocaleString()} icon={<ShieldX className="h-4 w-4" />} accent="bad" index={5} />
        <KpiCard title="Sending sources" value={k.distinctSources.toLocaleString()} icon={<Server className="h-4 w-4" />} index={6} />
      </div>
      <div className="card-elev rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 font-display text-sm font-semibold">Volume by day</h2>
        <VolumeChart data={volume} />
      </div>
    </div>
  );
}
