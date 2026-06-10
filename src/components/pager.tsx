import Link from "next/link";
import { buildQuery } from "@/lib/table-params";

export function Pager({
  basePath, params, page, pageSize, total,
}: {
  basePath: string;
  params: Record<string, string | number | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "rounded-md border px-3 py-1.5 text-sm";
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>Showing <span className="tabular-nums text-foreground">{from}-{to}</span> of <span className="tabular-nums text-foreground">{total.toLocaleString()}</span></span>
      <div className="flex items-center gap-1.5">
        <Link aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : 0}
          className={`${btn} ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted"}`}
          href={basePath + buildQuery(params, { page: page - 1 })}>Prev</Link>
        <span className="px-2 tabular-nums">Page {page} / {pages}</span>
        <Link aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : 0}
          className={`${btn} ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-muted"}`}
          href={basePath + buildQuery(params, { page: page + 1 })}>Next</Link>
      </div>
    </div>
  );
}
