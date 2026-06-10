import { getDb } from "./connection";

export interface Filters { domain?: string; from?: number; to?: number; }

function where(f: Filters): { clause: string; params: any[] } {
  const parts: string[] = []; const params: any[] = [];
  if (f.from) { parts.push("r.date_begin >= ?"); params.push(f.from); }
  if (f.to) { parts.push("r.date_end <= ?"); params.push(f.to); }
  if (f.domain) { parts.push("pp.domain = ?"); params.push(f.domain); }
  return { clause: parts.length ? "WHERE " + parts.join(" AND ") : "", params };
}

const JOIN = `FROM record rec
  JOIN report r ON r.id = rec.report_id
  LEFT JOIN policy_published pp ON pp.report_id = r.id`;

export function overviewKpis(dbPath: string | undefined, f: Filters) {
  const db = getDb(dbPath); const { clause, params } = where(f);
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(rec.count),0) AS totalMessages,
      COALESCE(SUM(CASE WHEN rec.dkim_aligned='pass' OR rec.spf_aligned='pass' THEN rec.count ELSE 0 END),0) AS dmarcPass,
      COALESCE(SUM(CASE WHEN rec.spf_aligned='pass' THEN rec.count ELSE 0 END),0) AS spfPass,
      COALESCE(SUM(CASE WHEN rec.dkim_aligned='pass' THEN rec.count ELSE 0 END),0) AS dkimPass,
      COALESCE(SUM(CASE WHEN rec.disposition='quarantine' THEN rec.count ELSE 0 END),0) AS quarantined,
      COALESCE(SUM(CASE WHEN rec.disposition='reject' THEN rec.count ELSE 0 END),0) AS rejected,
      COUNT(DISTINCT rec.source_ip_norm) AS distinctSources
    ${JOIN} ${clause}`).get(...params) as any;
  return row as {
    totalMessages: number; dmarcPass: number; spfPass: number; dkimPass: number;
    quarantined: number; rejected: number; distinctSources: number;
  };
}

export function volumeByDay(dbPath: string | undefined, f: Filters) {
  const db = getDb(dbPath); const { clause, params } = where(f);
  return db.prepare(`
    SELECT strftime('%Y-%m-%d', rec_begin, 'unixepoch') AS day,
      SUM(pass_c) AS pass, SUM(fail_c) AS fail
    FROM (
      SELECT r.date_begin AS rec_begin,
        CASE WHEN rec.dkim_aligned='pass' OR rec.spf_aligned='pass' THEN rec.count ELSE 0 END AS pass_c,
        CASE WHEN rec.dkim_aligned='pass' OR rec.spf_aligned='pass' THEN 0 ELSE rec.count END AS fail_c
      ${JOIN} ${clause}
    ) GROUP BY day ORDER BY day`).all(...params) as { day: string; pass: number; fail: number }[];
}

export function topSources(dbPath: string | undefined, f: Filters, limit = 20) {
  const db = getDb(dbPath); const { clause, params } = where(f);
  return db.prepare(`
    SELECT rec.source_ip AS sourceIp,
      SUM(rec.count) AS messages,
      SUM(CASE WHEN rec.dkim_aligned='pass' OR rec.spf_aligned='pass' THEN rec.count ELSE 0 END) AS pass,
      SUM(CASE WHEN rec.dkim_aligned='pass' OR rec.spf_aligned='pass' THEN 0 ELSE rec.count END) AS fail
    ${JOIN} ${clause}
    GROUP BY rec.source_ip ORDER BY messages DESC LIMIT ?`).all(...params, limit) as
    { sourceIp: string; messages: number; pass: number; fail: number }[];
}

export function dispositionBreakdown(dbPath: string | undefined, f: Filters) {
  const db = getDb(dbPath); const { clause, params } = where(f);
  return db.prepare(`
    SELECT COALESCE(rec.disposition,'(none)') AS disposition, SUM(rec.count) AS messages
    ${JOIN} ${clause}
    GROUP BY rec.disposition ORDER BY messages DESC`).all(...params) as
    { disposition: string; messages: number }[];
}

export function authQuadrant(dbPath: string | undefined, f: Filters) {
  const db = getDb(dbPath); const { clause, params } = where(f);
  return db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN dkim_aligned='pass' AND spf_aligned='pass' THEN count ELSE 0 END),0) AS both,
      COALESCE(SUM(CASE WHEN dkim_aligned='pass' AND (spf_aligned IS NULL OR spf_aligned<>'pass') THEN count ELSE 0 END),0) AS dkimOnly,
      COALESCE(SUM(CASE WHEN spf_aligned='pass' AND (dkim_aligned IS NULL OR dkim_aligned<>'pass') THEN count ELSE 0 END),0) AS spfOnly,
      COALESCE(SUM(CASE WHEN (dkim_aligned IS NULL OR dkim_aligned<>'pass') AND (spf_aligned IS NULL OR spf_aligned<>'pass') THEN count ELSE 0 END),0) AS neither
    FROM record rec JOIN report r ON r.id=rec.report_id LEFT JOIN policy_published pp ON pp.report_id=r.id ${clause}`)
    .get(...params) as { both: number; dkimOnly: number; spfOnly: number; neither: number };
}

export function listDomains(dbPath?: string) {
  return getDb(dbPath).prepare(`SELECT DISTINCT domain FROM policy_published WHERE domain IS NOT NULL ORDER BY domain`)
    .all().map((r: any) => r.domain) as string[];
}

export function recentReports(dbPath: string | undefined, limit = 100) {
  return getDb(dbPath).prepare(`
    SELECT r.id, r.org_name AS orgName, r.report_id AS reportId, r.date_begin AS dateBegin, r.date_end AS dateEnd,
      pp.domain, (SELECT COALESCE(SUM(count),0) FROM record WHERE report_id=r.id) AS messages
    FROM report r LEFT JOIN policy_published pp ON pp.report_id=r.id
    ORDER BY r.date_end DESC LIMIT ?`).all(limit) as any[];
}

export function reportDetail(dbPath: string | undefined, id: number) {
  const db = getDb(dbPath);
  const report = db.prepare(`SELECT * FROM report WHERE id=?`).get(id) as any;
  const policy = db.prepare(`SELECT * FROM policy_published WHERE report_id=?`).get(id) as any;
  const records = db.prepare(`SELECT * FROM record WHERE report_id=? ORDER BY count DESC`).all(id) as any[];
  return { report, policy, records };
}

export function ingestLog(dbPath: string | undefined, limit = 200) {
  return getDb(dbPath).prepare(`
    SELECT id, filename, reporter, status, records_ingested AS recordsIngested,
      dropped_fields AS droppedFields, error_detail AS errorDetail, processed_at AS processedAt
    FROM ingest_log ORDER BY processed_at DESC LIMIT ?`).all(limit) as any[];
}

export function digestSummary(dbPath: string | undefined, f: Filters, prevWindowStart: number) {
  const kpis = overviewKpis(dbPath, f);
  const top = topSources(dbPath, f, 10);
  const db = getDb(dbPath);
  const newSources = db.prepare(`
    SELECT DISTINCT rec.source_ip AS sourceIp
    FROM record rec JOIN report r ON r.id = rec.report_id
    WHERE r.date_begin >= ?
      AND rec.source_ip NOT IN (
        SELECT DISTINCT rec2.source_ip FROM record rec2 JOIN report r2 ON r2.id = rec2.report_id
        WHERE r2.date_begin < ?
      )`).all(f.from ?? 0, prevWindowStart).map((r: any) => r.sourceIp) as string[];
  return { kpis, topSources: top, newSources };
}

export function droppedFieldsSummary(dbPath?: string) {
  const rows = getDb(dbPath).prepare(`SELECT dropped_fields FROM ingest_log WHERE dropped_fields IS NOT NULL`).all() as any[];
  const counts = new Map<string, number>();
  for (const r of rows) for (const f of JSON.parse(r.dropped_fields) as string[]) counts.set(f, (counts.get(f) ?? 0) + 1);
  return Array.from(counts, ([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count);
}

// Paginated, sortable, filterable ingest log.
const INGEST_SORT: Record<string, string> = {
  filename: "filename", reporter: "reporter", status: "status",
  records: "records_ingested", when: "processed_at",
};
export function ingestLogPage(
  dbPath: string | undefined,
  p: { q: string; status: string; sort: string; dir: "asc" | "desc"; page: number; pageSize: number },
) {
  const db = getDb(dbPath);
  const where: string[] = []; const args: any[] = [];
  if (p.q) { where.push("(filename LIKE ? OR reporter LIKE ?)"); args.push(`%${p.q}%`, `%${p.q}%`); }
  if (p.status) { where.push("status = ?"); args.push(p.status); }
  const clause = where.length ? "WHERE " + where.join(" AND ") : "";
  const col = INGEST_SORT[p.sort] ?? "processed_at";
  const dir = p.dir === "asc" ? "ASC" : "DESC";
  const total = (db.prepare(`SELECT COUNT(*) c FROM ingest_log ${clause}`).get(...args) as any).c as number;
  const rows = db.prepare(
    `SELECT id, filename, reporter, status, records_ingested AS recordsIngested, error_detail AS errorDetail, processed_at AS processedAt
     FROM ingest_log ${clause} ORDER BY ${col} ${dir}, id DESC LIMIT ? OFFSET ?`
  ).all(...args, p.pageSize, (p.page - 1) * p.pageSize) as any[];
  return { rows, total };
}

// Paginated, sortable, filterable DMARC report list.
const REPORTS_SORT: Record<string, string> = {
  reporter: "r.org_name", domain: "pp.domain", range: "r.date_end", messages: "messages",
};
export function reportsPage(
  dbPath: string | undefined,
  p: { q: string; domain: string; sort: string; dir: "asc" | "desc"; page: number; pageSize: number },
) {
  const db = getDb(dbPath);
  const where: string[] = []; const args: any[] = [];
  if (p.q) { where.push("(r.org_name LIKE ? OR r.report_id LIKE ?)"); args.push(`%${p.q}%`, `%${p.q}%`); }
  if (p.domain) { where.push("pp.domain = ?"); args.push(p.domain); }
  const clause = where.length ? "WHERE " + where.join(" AND ") : "";
  const col = REPORTS_SORT[p.sort] ?? "r.date_end";
  const dir = p.dir === "asc" ? "ASC" : "DESC";
  const base = `FROM report r LEFT JOIN policy_published pp ON pp.report_id = r.id ${clause}`;
  const total = (db.prepare(`SELECT COUNT(*) c ${base}`).get(...args) as any).c as number;
  const rows = db.prepare(
    `SELECT r.id, r.org_name AS orgName, r.report_id AS reportId, r.date_begin AS dateBegin, r.date_end AS dateEnd, pp.domain,
       (SELECT COALESCE(SUM(count),0) FROM record WHERE report_id = r.id) AS messages
     ${base} ORDER BY ${col} ${dir}, r.id DESC LIMIT ? OFFSET ?`
  ).all(...args, p.pageSize, (p.page - 1) * p.pageSize) as any[];
  return { rows, total };
}

// DKIM (selector, signing-domain) pairs observed in ingested reports. Lets the DNS
// report look up the actual DKIM keys this domain's mail has been signed with.
export function observedDkimPairs(dbPath: string | undefined, headerFrom?: string): { selector: string; domain: string }[] {
  const db = getDb(dbPath);
  if (headerFrom) {
    return db.prepare(`
      SELECT DISTINCT ad.selector AS selector, ad.domain AS domain
      FROM auth_result_dkim ad JOIN record r ON r.id = ad.record_id
      WHERE ad.selector IS NOT NULL AND ad.selector <> '' AND ad.domain IS NOT NULL AND r.header_from = ?
      ORDER BY ad.domain, ad.selector`).all(headerFrom) as any[];
  }
  return db.prepare(`
    SELECT DISTINCT selector, domain FROM auth_result_dkim
    WHERE selector IS NOT NULL AND selector <> '' AND domain IS NOT NULL
    ORDER BY domain, selector`).all() as any[];
}
