import { bootstrap } from "@/lib/config";
import { topSources, listDomains } from "@/lib/db/queries";
import { parseFilters } from "@/lib/filters";
import { locate } from "@/lib/geo/geoip";
import { SourceTable } from "@/components/source-table";
import { GeoMap } from "@/components/geo-map";
import { FilterBar } from "@/components/filter-bar";

export const dynamic = "force-dynamic";

export default async function SourcesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const dbPath = bootstrap().dbPath;
  const f = parseFilters(sp);
  const sources = topSources(dbPath, f, 100);
  const domains = listDomains(dbPath);

  const points: { lat: number; lon: number; messages: number; failRate: number }[] = [];
  for (const s of sources.slice(0, 100)) {
    const geo = await locate(s.sourceIp);
    if (geo) points.push({ lat: geo.lat, lon: geo.lon, messages: s.messages, failRate: s.messages ? s.fail / s.messages : 0 });
  }

  return (
    <div>
      <FilterBar domains={domains} />
      {points.length > 0 && (
        <div className="mb-6 rounded-xl border bg-background p-4">
          <h2 className="mb-2 text-sm font-medium">Source geography (red = mostly failing)</h2>
          <GeoMap points={points} />
        </div>
      )}
      <div className="rounded-xl border bg-background p-4">
        <h2 className="mb-4 text-sm font-medium">Top sending sources</h2>
        <SourceTable rows={sources} />
      </div>
    </div>
  );
}
