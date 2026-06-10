import type { Filters } from "@/lib/db/queries";

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const from = get("from"); const to = get("to");
  return {
    domain: get("domain") || undefined,
    from: from ? Math.floor(new Date(from).getTime() / 1000) : undefined,
    to: to ? Math.floor(new Date(to + "T23:59:59").getTime() / 1000) : undefined,
  };
}
