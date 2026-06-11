import { bootstrap } from "@/lib/config";
import { dispositionBreakdown, listDomains } from "@/lib/db/queries";
import { parseFilters } from "@/lib/filters";
import { BreakdownBar } from "@/components/breakdown-bar";
import { FilterBar } from "@/components/filter-bar";
import { HelpLink } from "@/components/help-link";

export const dynamic = "force-dynamic";

export default async function PolicyPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const dbPath = bootstrap().dbPath;
  const d = dispositionBreakdown(dbPath, parseFilters(sp));
  const domains = listDomains(dbPath);
  return (
    <div>
      <FilterBar domains={domains} />
      <div className="card-elev rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold">Disposition breakdown</h2>
          <HelpLink href="/docs/reading-the-dashboard#policy" />
        </div>
        <p className="mb-4 text-xs text-muted-foreground">Policy actions applied to messages across the selected range.</p>
        <BreakdownBar rows={d.map((r) => ({ label: r.disposition, value: r.messages }))} />
      </div>
    </div>
  );
}
