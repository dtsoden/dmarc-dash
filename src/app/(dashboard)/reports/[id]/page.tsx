import { bootstrap } from "@/lib/config";
import { reportDetail } from "@/lib/db/queries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const pill = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

function AlignPill({ value }: { value: string }) {
  const pass = value === "pass";
  return (
    <span className={`${pill} ${pass ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-red-500/12 text-red-600 dark:text-red-400"}`}>
      {value}
    </span>
  );
}

function DispositionPill({ value }: { value: string }) {
  const v = (value ?? "").toLowerCase();
  const cls =
    v === "reject" ? "bg-red-500/12 text-red-600 dark:text-red-400" :
    v === "quarantine" ? "bg-amber-500/12 text-amber-600 dark:text-amber-400" :
    v === "pass" ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" :
    "bg-muted text-muted-foreground";
  return <span className={`${pill} ${cls}`}>{value}</span>;
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { report, policy, records } = reportDetail(bootstrap().dbPath, Number(id));
  if (!report) return <div className="text-sm text-muted-foreground">Report not found.</div>;
  return (
    <div className="space-y-6">
      <div className="card-elev rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">{report.org_name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Domain <span className="font-mono text-xs text-foreground">{policy?.domain}</span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Report <span className="font-mono">{report.report_id}</span>
          {" · "}policy p={policy?.p ?? "-"} sp={policy?.sp ?? "-"} adkim={policy?.adkim ?? "-"} aspf={policy?.aspf ?? "-"}
        </p>
      </div>
      <div className="card-elev rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 font-display text-sm font-semibold">Records</h2>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Source IP</TableHead><TableHead className="text-right">Count</TableHead>
            <TableHead>Disposition</TableHead><TableHead>DKIM</TableHead><TableHead>SPF</TableHead><TableHead>Header From</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {records.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.source_ip}</TableCell>
                <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                <TableCell><DispositionPill value={r.disposition} /></TableCell>
                <TableCell><AlignPill value={r.dkim_aligned} /></TableCell>
                <TableCell><AlignPill value={r.spf_aligned} /></TableCell>
                <TableCell className="font-mono text-xs">{r.header_from}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
