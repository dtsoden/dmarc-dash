import { bootstrap } from "@/lib/config";
import { authQuadrant, listDomains } from "@/lib/db/queries";
import { parseFilters } from "@/lib/filters";
import { KpiCard } from "@/components/kpi-card";
import { FilterBar } from "@/components/filter-bar";
import { HelpLink } from "@/components/help-link";
import { ShieldCheck, KeyRound, ShieldX } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const dbPath = bootstrap().dbPath;
  const q = authQuadrant(dbPath, parseFilters(sp));
  const domains = listDomains(dbPath);
  return (
    <div>
      <FilterBar domains={domains} />
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Authentication coverage</h2>
          <p className="text-sm text-muted-foreground">How messages aligned across SPF and DKIM for the selected range.</p>
        </div>
        <HelpLink href="/docs/reading-the-dashboard#authentication" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard title="SPF + DKIM" value={q.both.toLocaleString()} sub="Both aligned" icon={<ShieldCheck className="h-4 w-4" />} accent="good" index={0} />
        <KpiCard title="DKIM only" value={q.dkimOnly.toLocaleString()} sub="DKIM aligned" icon={<KeyRound className="h-4 w-4" />} accent="warn" index={1} />
        <KpiCard title="SPF only" value={q.spfOnly.toLocaleString()} sub="SPF aligned" icon={<ShieldCheck className="h-4 w-4" />} accent="warn" index={2} />
        <KpiCard title="Neither" value={q.neither.toLocaleString()} sub="No alignment" icon={<ShieldX className="h-4 w-4" />} accent="bad" index={3} />
      </div>
    </div>
  );
}
