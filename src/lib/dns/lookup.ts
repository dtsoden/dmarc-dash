import { promises as dns } from "node:dns";

// Use public resolvers for consistent, authoritative-ish answers regardless of host DNS.
try { dns.setServers(["1.1.1.1", "8.8.8.8"]); } catch { /* ignore */ }

async function txt(name: string): Promise<string[]> {
  try {
    const recs = await dns.resolveTxt(name);
    return recs.map((parts) => parts.join(""));
  } catch { return []; }
}

export interface DnsRecord { name: string; found: boolean; values: string[] }
export interface DkimResult { selector: string; domain: string; found: boolean; value?: string }
export interface DnsReport {
  domain: string;
  checkedAt: number;
  spf: DnsRecord;
  dmarc: DnsRecord;
  dkim: DkimResult[];
  mx: { found: boolean; hosts: { exchange: string; priority: number }[] };
  bimi: DnsRecord;
  mtaSts: DnsRecord;
  tlsRpt: DnsRecord;
}

export async function getDnsReport(
  domain: string,
  dkimPairs: { selector: string; domain: string }[],
  now: number,
): Promise<DnsReport> {
  const [spfAll, dmarcAll, bimiAll, mtaAll, tlsAll, mxRecs] = await Promise.all([
    txt(domain),
    txt(`_dmarc.${domain}`),
    txt(`default._bimi.${domain}`),
    txt(`_mta-sts.${domain}`),
    txt(`_smtp._tls.${domain}`),
    dns.resolveMx(domain).catch(() => [] as { exchange: string; priority: number }[]),
  ]);

  const spf = spfAll.filter((v) => /^v=spf1/i.test(v));
  const dmarc = dmarcAll.filter((v) => /^v=DMARC1/i.test(v));

  // De-dup the (selector, domain) pairs, then resolve each DKIM key record.
  const seen = new Set<string>();
  const pairs = dkimPairs.filter((p) => {
    const k = `${p.selector}|${p.domain}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  });
  const dkim = await Promise.all(pairs.map(async (p) => {
    const recs = await txt(`${p.selector}._domainkey.${p.domain}`);
    const v = recs.find((r) => /v=DKIM1|(^|;)\s*p=/i.test(r));
    return { selector: p.selector, domain: p.domain, found: !!v, value: v };
  }));

  return {
    domain,
    checkedAt: now,
    spf: { name: domain, found: spf.length > 0, values: spf },
    dmarc: { name: `_dmarc.${domain}`, found: dmarc.length > 0, values: dmarc },
    dkim,
    mx: { found: mxRecs.length > 0, hosts: mxRecs.map((m) => ({ exchange: m.exchange, priority: m.priority })).sort((a, b) => a.priority - b.priority) },
    bimi: { name: `default._bimi.${domain}`, found: bimiAll.length > 0, values: bimiAll },
    mtaSts: { name: `_mta-sts.${domain}`, found: mtaAll.length > 0, values: mtaAll },
    tlsRpt: { name: `_smtp._tls.${domain}`, found: tlsAll.length > 0, values: tlsAll },
  };
}
