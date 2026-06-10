import Link from "next/link";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { buildQuery } from "@/lib/table-params";

export function SortHeader({
  label, col, basePath, params, align,
}: {
  label: string;
  col: string;
  basePath: string;
  params: Record<string, string | number | undefined>;
  align?: "right";
}) {
  const active = params.sort === col;
  const dir = params.dir === "asc" ? "asc" : "desc";
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  const href = basePath + buildQuery(params, { sort: col, dir: nextDir, page: 1 });
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <Link href={href} className="group inline-flex items-center gap-1 hover:text-foreground">
        {label}
        {active
          ? (dir === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-primary" />)
          : <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50" />}
      </Link>
    </TableHead>
  );
}
