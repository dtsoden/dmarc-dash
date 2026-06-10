import { bootstrap } from "@/lib/config";
import { ingestLogPage, droppedFieldsSummary } from "@/lib/db/queries";
import { parseTableParams } from "@/lib/table-params";
import { BreakdownBar } from "@/components/breakdown-bar";
import { TableToolbar } from "@/components/table-toolbar";
import { SortHeader } from "@/components/sort-header";
import { Pager } from "@/components/pager";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const statusClass: Record<string, string> = {
  ingested: "text-emerald-600 dark:text-emerald-400",
  duplicate: "text-amber-600 dark:text-amber-400",
  failed: "text-red-600 dark:text-red-400",
};

export default async function IngestLogPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const dbPath = bootstrap().dbPath;
  const tp = parseTableParams(sp, { sortCols: ["filename", "reporter", "status", "records", "when"], defaultSort: "when", defaultDir: "desc" });
  const { rows, total } = ingestLogPage(dbPath, tp);
  const dropped = droppedFieldsSummary(dbPath);
  const linkParams = { q: tp.q, status: tp.status, sort: tp.sort, dir: tp.dir, pageSize: tp.pageSize };

  return (
    <div className="space-y-6">
      <div className="card-elev rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 font-display text-sm font-semibold">Dropped / unknown fields <span className="font-normal text-muted-foreground">(review for schema gaps)</span></h2>
        {dropped.length
          ? <BreakdownBar rows={dropped.map((d) => ({ label: d.field, value: d.count }))} />
          : <p className="text-sm text-muted-foreground">No unknown fields seen. The schema covers all incoming data.</p>}
      </div>

      <div className="card-elev rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 font-display text-sm font-semibold">Ingest history</h2>
        <TableToolbar searchPlaceholder="Search file or reporter..." filters={[{
          key: "status", label: "All statuses",
          options: [{ value: "ingested", label: "Ingested" }, { value: "duplicate", label: "Duplicate" }, { value: "failed", label: "Failed" }],
        }]} />
        <Table>
          <TableHeader><TableRow>
            <SortHeader label="File" col="filename" basePath="/ingest-log" params={linkParams} />
            <SortHeader label="Reporter" col="reporter" basePath="/ingest-log" params={linkParams} />
            <SortHeader label="Status" col="status" basePath="/ingest-log" params={linkParams} />
            <SortHeader label="Records" col="records" basePath="/ingest-log" params={linkParams} align="right" />
            <SortHeader label="When" col="when" basePath="/ingest-log" params={linkParams} />
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No matching ingest events.</TableCell></TableRow>
            )}
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-[320px] truncate font-mono text-xs" title={r.filename}>{r.filename}</TableCell>
                <TableCell className="text-sm">{r.reporter ?? "-"}</TableCell>
                <TableCell className={`text-sm font-medium ${statusClass[r.status] ?? ""}`}>{r.status}</TableCell>
                <TableCell className="text-right tabular-nums">{r.recordsIngested}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{new Date(r.processedAt * 1000).toISOString().replace("T", " ").slice(0, 16)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager basePath="/ingest-log" params={linkParams} page={tp.page} pageSize={tp.pageSize} total={total} />
      </div>
    </div>
  );
}
