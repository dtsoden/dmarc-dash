import { bootstrap } from "@/lib/config";
import { ingestLog, droppedFieldsSummary } from "@/lib/db/queries";
import { BreakdownBar } from "@/components/breakdown-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function IngestLogPage() {
  const dbPath = bootstrap().dbPath;
  const log = ingestLog(dbPath, 200);
  const dropped = droppedFieldsSummary(dbPath);
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-background p-4">
        <h2 className="mb-4 text-sm font-medium">Dropped / unknown fields (review for schema gaps)</h2>
        {dropped.length ? <BreakdownBar rows={dropped.map((d) => ({ label: d.field, value: d.count }))} />
          : <p className="text-sm text-muted-foreground">No unknown fields seen. Schema covers all incoming data.</p>}
      </div>
      <div className="rounded-xl border bg-background p-4">
        <h2 className="mb-4 text-sm font-medium">Ingest history</h2>
        <Table>
          <TableHeader><TableRow>
            <TableHead>File</TableHead><TableHead>Reporter</TableHead><TableHead>Status</TableHead>
            <TableHead className="text-right">Records</TableHead><TableHead>When</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {log.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.filename}</TableCell>
                <TableCell>{r.reporter ?? "-"}</TableCell>
                <TableCell className={r.status === "failed" ? "text-red-600" : r.status === "duplicate" ? "text-amber-600" : "text-green-600"}>{r.status}</TableCell>
                <TableCell className="text-right">{r.recordsIngested}</TableCell>
                <TableCell className="text-xs">{new Date(r.processedAt * 1000).toISOString().replace("T", " ").slice(0, 16)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
