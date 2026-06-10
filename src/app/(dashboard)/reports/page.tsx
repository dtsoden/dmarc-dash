import Link from "next/link";
import { bootstrap } from "@/lib/config";
import { recentReports } from "@/lib/db/queries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const rows = recentReports(bootstrap().dbPath, 200);
  return (
    <div className="rounded-xl border bg-background p-4">
      <h2 className="mb-4 text-sm font-medium">Recent reports</h2>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Reporter</TableHead><TableHead>Domain</TableHead>
          <TableHead>Range</TableHead><TableHead className="text-right">Messages</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell><Link className="text-primary underline" href={`/reports/${r.id}`}>{r.orgName}</Link></TableCell>
              <TableCell>{r.domain ?? "-"}</TableCell>
              <TableCell className="text-xs">{new Date(r.dateBegin * 1000).toISOString().slice(0, 10)} → {new Date(r.dateEnd * 1000).toISOString().slice(0, 10)}</TableCell>
              <TableCell className="text-right">{Number(r.messages).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
