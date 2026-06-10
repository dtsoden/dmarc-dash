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
        {rows.map((r) => (
          <TableRow key={r.sourceIp}>
            <TableCell className="font-mono text-xs">{r.sourceIp}</TableCell>
            <TableCell className="text-right">{r.messages.toLocaleString()}</TableCell>
            <TableCell className="text-right text-green-600">{r.pass.toLocaleString()}</TableCell>
            <TableCell className="text-right text-red-600">{r.fail.toLocaleString()}</TableCell>
            <TableCell className="text-right">{r.messages ? Math.round((r.pass / r.messages) * 100) : 0}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
