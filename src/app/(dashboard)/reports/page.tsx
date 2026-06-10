import Link from "next/link";
import { bootstrap } from "@/lib/config";
import { reportsPage, listDomains } from "@/lib/db/queries";
import { parseTableParams } from "@/lib/table-params";
import { TableToolbar } from "@/components/table-toolbar";
import { SortHeader } from "@/components/sort-header";
import { Pager } from "@/components/pager";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const dbPath = bootstrap().dbPath;
  const tp = parseTableParams(sp, { sortCols: ["reporter", "domain", "range", "messages"], defaultSort: "range", defaultDir: "desc" });
  const { rows, total } = reportsPage(dbPath, tp);
  const domains = listDomains(dbPath);
  const linkParams = { q: tp.q, domain: tp.domain, sort: tp.sort, dir: tp.dir, pageSize: tp.pageSize };

  return (
    <div className="card-elev rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 font-display text-sm font-semibold">DMARC reports</h2>
      <TableToolbar searchPlaceholder="Search reporter or report ID..." filters={[{
        key: "domain", label: "All domains",
        options: domains.map((d) => ({ value: d, label: d })),
      }]} />
      <Table>
        <TableHeader><TableRow>
          <SortHeader label="Reporter" col="reporter" basePath="/reports" params={linkParams} />
          <SortHeader label="Domain" col="domain" basePath="/reports" params={linkParams} />
          <SortHeader label="Range" col="range" basePath="/reports" params={linkParams} />
          <SortHeader label="Messages" col="messages" basePath="/reports" params={linkParams} align="right" />
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No matching reports.</TableCell></TableRow>
          )}
          {rows.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell><Link className="font-medium text-primary hover:underline" href={`/reports/${r.id}`}>{r.orgName}</Link></TableCell>
              <TableCell className="text-sm">{r.domain ?? "-"}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{new Date(r.dateBegin * 1000).toISOString().slice(0, 10)} → {new Date(r.dateEnd * 1000).toISOString().slice(0, 10)}</TableCell>
              <TableCell className="text-right tabular-nums">{Number(r.messages).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pager basePath="/reports" params={linkParams} page={tp.page} pageSize={tp.pageSize} total={total} />
    </div>
  );
}
