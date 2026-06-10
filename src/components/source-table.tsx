import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function SourceTable({ rows }: { rows: { sourceIp: string; messages: number; pass: number; fail: number }[] }) {
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Source IP</TableHead><TableHead className="text-right">Messages</TableHead>
        <TableHead className="text-right">Pass</TableHead><TableHead className="text-right">Fail</TableHead>
        <TableHead className="text-right">Pass rate</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((r) => {
          const rate = r.messages ? Math.round((r.pass / r.messages) * 100) : 0;
          const rateColor = rate >= 90 ? "text-emerald-600 dark:text-emerald-400" : rate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
          return (
            <TableRow key={r.sourceIp}>
              <TableCell className="font-mono text-xs">{r.sourceIp}</TableCell>
              <TableCell className="text-right tabular-nums">{r.messages.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{r.pass.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums font-medium text-red-600 dark:text-red-400">{r.fail.toLocaleString()}</TableCell>
              <TableCell className={`text-right tabular-nums font-semibold ${rateColor}`}>{rate}%</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
