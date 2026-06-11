import { bootstrap } from "@/lib/config";
import { topSources, listDomains } from "@/lib/db/queries";
import { parseFilters } from "@/lib/filters";
import { locate } from "@/lib/geo/geoip";
import { SourceTable } from "@/components/source-table";
import { GeoMap } from "@/components/geo-map";
import { FilterBar } from "@/components/filter-bar";
import { HelpLink } from "@/components/help-link";

export const dynamic = "force-dynamic";

export default async function SourcesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const dbPath = bootstrap().dbPath;
  const f = parseFilters(sp);
  const sources = topSources(dbPath, f, 100);
  const domains = listDomains(dbPath);

  const points: { lat: number; lon: number; messages: number; failRate: number; sourceIp: string; pass: number; fail: number; country?: string }[] = [];
  for (const s of sources.slice(0, 100)) {
    const geo = await locate(s.sourceIp);
    if (geo) points.push({
      lat: geo.lat, lon: geo.lon, messages: s.messages, failRate: s.messages ? s.fail / s.messages : 0,
      sourceIp: s.sourceIp, pass: s.pass, fail: s.fail, country: geo.country,
    });
  }

  return (
    <div>
      <FilterBar domains={domains} />
      {points.length > 0 && (
        <div className="card-elev mb-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-sm font-semibold">Source geography</h2>
          <p className="mb-3 text-xs text-muted-foreground">Red markers indicate sources that are mostly failing DMARC.</p>
          <GeoMap points={points} />
        </div>
      )}
      <div className="card-elev rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold">Top sending sources</h2>
          <HelpLink href="/docs/geoip" />
        </div>
        <p className="mb-4 text-xs text-muted-foreground">Ranked by message volume across the selected range.</p>
        <SourceTable rows={sources} />
      </div>
    </div>
  );
}
