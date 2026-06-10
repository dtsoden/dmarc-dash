import { getDb } from "./connection";
import type { DmarcReport } from "@/lib/ingest/model";

export function insertReport(r: DmarcReport, dbPath?: string): { inserted: boolean; reportRowId?: number } {
  const db = getDb(dbPath);
  const txn = db.transaction((rep: DmarcReport) => {
    const exists = db.prepare(
      "SELECT id FROM report WHERE org_name=? AND report_id=? AND date_begin=? AND date_end=?"
    ).get(rep.orgName, rep.reportId, rep.dateBegin, rep.dateEnd) as { id: number } | undefined;
    if (exists) return { inserted: false, reportRowId: exists.id };

    const repId = db.prepare(
      `INSERT INTO report (org_name,reporter_email,extra_contact_info,report_id,date_begin,date_end,error,generator,schema_namespace,source_filename,raw_xml,ingested_at)
       VALUES (@orgName,@reporterEmail,@extraContactInfo,@reportId,@dateBegin,@dateEnd,@error,@generator,@schemaNamespace,@sourceFilename,@rawXml,@ingestedAt)`
    ).run({
      orgName: rep.orgName, reporterEmail: rep.reporterEmail ?? null,
      extraContactInfo: rep.extraContactInfo ?? null, reportId: rep.reportId,
      dateBegin: rep.dateBegin, dateEnd: rep.dateEnd, error: rep.error ?? null,
      generator: rep.generator ?? null, schemaNamespace: rep.schemaNamespace ?? null,
      sourceFilename: rep.sourceFilename ?? null, rawXml: rep.rawXml ?? null,
      ingestedAt: Math.floor(Date.now() / 1000),
    }).lastInsertRowid as number;

    db.prepare(
      `INSERT INTO policy_published (report_id,domain,p,sp,np,adkim,aspf,pct,fo,discovery_method,testing)
       VALUES (@report_id,@domain,@p,@sp,@np,@adkim,@aspf,@pct,@fo,@discovery_method,@testing)`
    ).run({
      report_id: repId, domain: rep.policy.domain ?? null, p: rep.policy.p ?? null,
      sp: rep.policy.sp ?? null, np: rep.policy.np ?? null, adkim: rep.policy.adkim ?? null,
      aspf: rep.policy.aspf ?? null, pct: rep.policy.pct ?? null, fo: rep.policy.fo ?? null,
      discovery_method: rep.policy.discoveryMethod ?? null, testing: rep.policy.testing ?? null,
    });

    const insRec = db.prepare(
      `INSERT INTO record (report_id,source_ip,source_ip_norm,count,disposition,dkim_aligned,spf_aligned,header_from,envelope_from,envelope_to)
       VALUES (@report_id,@source_ip,@source_ip_norm,@count,@disposition,@dkim_aligned,@spf_aligned,@header_from,@envelope_from,@envelope_to)`
    );
    const insDkim = db.prepare(`INSERT INTO auth_result_dkim (record_id,domain,selector,result,human_result) VALUES (?,?,?,?,?)`);
    const insSpf = db.prepare(`INSERT INTO auth_result_spf (record_id,domain,scope,result,human_result) VALUES (?,?,?,?,?)`);
    const insReason = db.prepare(`INSERT INTO policy_override_reason (record_id,type,comment) VALUES (?,?,?)`);

    for (const rec of rep.records) {
      const recId = insRec.run({
        report_id: repId, source_ip: rec.sourceIp ?? null, source_ip_norm: rec.sourceIpNorm ?? null,
        count: rec.count ?? 0, disposition: rec.disposition ?? null, dkim_aligned: rec.dkimAligned ?? null,
        spf_aligned: rec.spfAligned ?? null, header_from: rec.headerFrom ?? null,
        envelope_from: rec.envelopeFrom ?? null, envelope_to: rec.envelopeTo ?? null,
      }).lastInsertRowid as number;
      for (const d of rec.authDkim) insDkim.run(recId, d.domain ?? null, d.selector ?? null, d.result ?? null, d.humanResult ?? null);
      for (const s of rec.authSpf) insSpf.run(recId, s.domain ?? null, s.scope ?? null, s.result ?? null, s.humanResult ?? null);
      for (const x of rec.reasons) insReason.run(recId, x.type ?? null, x.comment ?? null);
    }

    if (rep.extensions?.length) {
      const insExt = db.prepare(`INSERT INTO report_extension (report_id,namespace,element_name,raw_xml) VALUES (?,?,?,?)`);
      for (const e of rep.extensions) insExt.run(repId, e.namespace ?? null, e.elementName ?? null, e.rawXml ?? null);
    }
    return { inserted: true, reportRowId: repId };
  });
  return txn(r);
}
