import { bootstrap } from "@/lib/config";
import { reportDetail } from "@/lib/db/queries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { report, policy, records } = reportDetail(bootstrap().dbPath, Number(id));
  if (!report) return <div>Report not found.</div>;
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-background p-4">
        <h2 className="mb-2 text-sm font-medium">{report.org_name} — {policy?.domain}</h2>
        <p className="text-xs text-muted-foreground">Report {report.report_id} · policy p={policy?.p ?? "-"} sp={policy?.sp ?? "-"} adkim={policy?.adkim ?? "-"} aspf={policy?.aspf ?? "-"}</p>
      </div>
      <div className="rounded-xl border bg-background p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Source IP</TableHead><TableHead className="text-right">Count</TableHead>
            <TableHead>Disposition</TableHead><TableHead>DKIM</TableHead><TableHead>SPF</TableHead><TableHead>Header From</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {records.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.source_ip}</TableCell>
                <TableCell className="text-right">{r.count}</TableCell>
                <TableCell>{r.disposition}</TableCell>
                <TableCell className={r.dkim_aligned === "pass" ? "text-green-600" : "text-red-600"}>{r.dkim_aligned}</TableCell>
                <TableCell className={r.spf_aligned === "pass" ? "text-green-600" : "text-red-600"}>{r.spf_aligned}</TableCell>
                <TableCell>{r.header_from}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
