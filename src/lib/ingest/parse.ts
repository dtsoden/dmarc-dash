import { XMLParser } from "fast-xml-parser";
import type { DmarcReport, DmarcRecord } from "./model";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false, // keep everything as strings; we coerce explicitly
});

function arr<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}
function str(v: any): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "object") return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}
function num(v: any): number | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
function normIp(ip?: string): string | undefined {
  if (!ip) return undefined;
  return ip.trim().toLowerCase();
}

export function parseDmarcXml(xml: string, filename?: string): DmarcReport {
  const doc = parser.parse(xml);
  const fb = doc.feedback;
  if (!fb) throw new Error(`No <feedback> root in ${filename ?? "report"}`);

  const schemaNamespace = str(fb["@_xmlns"]);
  const meta = fb.report_metadata ?? {};
  const dr = meta.date_range ?? {};
  const pp = fb.policy_published ?? {};

  const records: DmarcRecord[] = arr<any>(fb.record).map((rec) => {
    const row = rec.row ?? {};
    const pe = row.policy_evaluated ?? {};
    const ids = rec.identifiers ?? {};
    const ar = rec.auth_results ?? {};
    return {
      sourceIp: str(row.source_ip),
      sourceIpNorm: normIp(str(row.source_ip)),
      count: num(row.count) ?? 0,
      disposition: str(pe.disposition),
      dkimAligned: str(pe.dkim),
      spfAligned: str(pe.spf),
      headerFrom: str(ids.header_from),
      envelopeFrom: str(ids.envelope_from),
      envelopeTo: str(ids.envelope_to),
      authDkim: arr<any>(ar.dkim).map((d) => ({
        domain: str(d.domain), selector: str(d.selector), result: str(d.result), humanResult: str(d.human_result),
      })),
      authSpf: arr<any>(ar.spf).map((s) => ({
        domain: str(s.domain), scope: str(s.scope), result: str(s.result), humanResult: str(s.human_result),
      })),
      reasons: arr<any>(pe.reason).map((x) => ({ type: str(x.type), comment: str(x.comment) })),
    };
  });

  return {
    orgName: str(meta.org_name) ?? "unknown",
    reporterEmail: str(meta.email),
    extraContactInfo: str(meta.extra_contact_info),
    reportId: str(meta.report_id) ?? "unknown",
    dateBegin: num(dr.begin) ?? 0,
    dateEnd: num(dr.end) ?? 0,
    error: arr<any>(meta.error).map(str).filter(Boolean).join("; ") || undefined,
    generator: str(meta.generator),
    schemaNamespace,
    sourceFilename: filename,
    rawXml: xml,
    policy: {
      domain: str(pp.domain), p: str(pp.p), sp: str(pp.sp), np: str(pp.np),
      adkim: str(pp.adkim), aspf: str(pp.aspf), pct: num(pp.pct) ?? null, fo: str(pp.fo),
      discoveryMethod: str(pp.discovery_method), testing: str(pp.testing),
    },
    records,
  };
}

const KNOWN: Record<string, Set<string>> = {
  feedback: new Set(["version","report_metadata","policy_published","record","extension","@_xmlns"]),
  report_metadata: new Set(["org_name","email","extra_contact_info","report_id","date_range","error","generator"]),
  date_range: new Set(["begin","end"]),
  policy_published: new Set(["domain","p","sp","np","adkim","aspf","pct","fo","discovery_method","testing"]),
  record: new Set(["row","identifiers","auth_results"]),
  row: new Set(["source_ip","count","policy_evaluated"]),
  policy_evaluated: new Set(["disposition","dkim","spf","reason"]),
  reason: new Set(["type","comment"]),
  identifiers: new Set(["header_from","envelope_from","envelope_to"]),
  auth_results: new Set(["dkim","spf"]),
};

export function collectUnknownFields(xml: string): string[] {
  const doc = parser.parse(xml);
  const result: string[] = [];
  const walk2 = (node: any, name: string, prefix: string) => {
    if (node === null || typeof node !== "object") return;
    const known = KNOWN[name];
    for (const key of Object.keys(node)) {
      if (key.startsWith("@_")) continue;
      const p = prefix ? `${prefix}.${key}` : key;
      if (known && !known.has(key)) result.push(p);
      for (const c of (Array.isArray(node[key]) ? node[key] : [node[key]])) walk2(c, key, p);
    }
  };
  walk2(doc.feedback, "feedback", "");
  return Array.from(new Set(result));
}
