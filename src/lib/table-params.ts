export interface TableParams {
  q: string;
  status: string;
  domain: string;
  sort: string;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
}

export const PAGE_SIZES = [25, 50, 100];

export function parseTableParams(
  sp: Record<string, string | string[] | undefined>,
  opts: { sortCols: string[]; defaultSort: string; defaultDir?: "asc" | "desc" },
): TableParams {
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const sort = opts.sortCols.includes(get("sort")) ? get("sort") : opts.defaultSort;
  const dirRaw = get("dir");
  const dir = dirRaw === "asc" || dirRaw === "desc" ? (dirRaw as "asc" | "desc") : (opts.defaultDir ?? "desc");
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);
  const ps = parseInt(get("pageSize") || "25", 10);
  const pageSize = PAGE_SIZES.includes(ps) ? ps : 25;
  return { q: get("q"), status: get("status"), domain: get("domain"), sort, dir, page, pageSize };
}

// Build a querystring from base params merged with overrides (empty values dropped).
export function buildQuery(
  base: Record<string, string | number | undefined>,
  override: Record<string, string | number | undefined> = {},
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...override })) {
    if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? "?" + s : "";
}
