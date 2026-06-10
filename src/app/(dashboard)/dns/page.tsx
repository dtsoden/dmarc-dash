import { bootstrap } from "@/lib/config";
import { listDomains, observedDkimPairs } from "@/lib/db/queries";
import { getDnsReport, type DnsRecord } from "@/lib/dns/lookup";
import { HelpLink } from "@/components/help-link";

export const dynamic = "force-dynamic";

function Pill({ ok, optional }: { ok: boolean; optional?: boolean }) {
  if (ok) return <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Found</span>;
  return optional
    ? <span className="rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">Not set</span>
    : <span className="rounded-full bg-red-500/12 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400">Missing</span>;
}

function RecordCard({ title, rec, optional, hint }: { title: string; rec: DnsRecord; optional?: boolean; hint?: string }) {
  return (
    <div className="card-elev rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold">{title}</h3>
          <p className="font-mono text-[11px] text-muted-foreground">{rec.name}</p>
        </div>
        <Pill ok={rec.found} optional={optional} />
      </div>
      {rec.found ? (
        <div className="mt-3 space-y-1.5">
          {rec.values.map((v, i) => (
            <pre key={i} className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs text-foreground">{v}</pre>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{hint ?? "No record published."}</p>
      )}
    </div>
  );
}

export default async function DnsReportPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const dbPath = bootstrap().dbPath;
  const domains = listDomains(dbPath);
  const domain = (sp.domain || domains[0] || "").trim().toLowerCase();

  const report = domain ? await getDnsReport(domain, observedDkimPairs(dbPath, domain), Math.floor(Date.now() / 1000)) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">DNS authentication report</h2>
          <p className="mt-1 text-sm text-muted-foreground">Read-only snapshot of the email-authentication DNS records for a domain. This queries DNS only; it never changes anything.</p>
        </div>
        <HelpLink href="/docs/dns-report" />
      </div>

      {/* Domain chooser */}
      <form className="flex flex-wrap items-center gap-2" action="/dns" method="get">
        <input name="domain" defaultValue={domain} placeholder="example.com"
          className="w-64 rounded-md border px-3 py-2 font-mono text-sm" />
        <button className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground" type="submit">Check</button>
        {domains.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Observed:</span>
            {domains.map((d) => (
              <a key={d} href={`/dns?domain=${encodeURIComponent(d)}`}
                className={`rounded-full border px-2.5 py-1 text-xs ${d === domain ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>{d}</a>
            ))}
          </div>
        )}
      </form>

      {!domain && <p className="text-sm text-muted-foreground">No domains observed yet. Once reports are ingested their domains appear here, or type a domain above.</p>}

      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <RecordCard title="SPF" rec={report.spf} hint="No SPF record (v=spf1) found, senders can't be authorized via SPF." />
            <RecordCard title="DMARC" rec={report.dmarc} hint="No DMARC policy (_dmarc) found." />
          </div>

          {/* MX */}
          <div className="card-elev rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold">MX records</h3>
              <Pill ok={report.mx.found} />
            </div>
            {report.mx.found ? (
              <div className="mt-3 space-y-1">
                {report.mx.hosts.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 font-mono text-xs">
                    <span className="w-10 text-muted-foreground">{h.priority}</span>
                    <span>{h.exchange}</span>
                  </div>
                ))}
              </div>
            ) : <p className="mt-3 text-xs text-muted-foreground">No MX records.</p>}
          </div>

          {/* DKIM */}
          <div className="card-elev rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-semibold">DKIM keys</h3>
                <p className="text-[11px] text-muted-foreground">Selectors observed in this domain's ingested reports.</p>
              </div>
              <span className="text-xs text-muted-foreground">{report.dkim.length} selector{report.dkim.length === 1 ? "" : "s"}</span>
            </div>
            {report.dkim.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">No DKIM selectors observed yet. They appear here as reports are ingested.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {report.dkim.map((k, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
                    <span className="font-mono text-xs">{k.selector}._domainkey.{k.domain}</span>
                    <Pill ok={k.found} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <RecordCard title="BIMI" rec={report.bimi} optional hint="No BIMI record (optional brand logo)." />
            <RecordCard title="MTA-STS" rec={report.mtaSts} optional hint="No MTA-STS record (optional TLS policy)." />
            <RecordCard title="TLS-RPT" rec={report.tlsRpt} optional hint="No TLS reporting record (optional)." />
          </div>

          <p className="text-xs text-muted-foreground">Checked {domain} via public DNS (1.1.1.1 / 8.8.8.8). Read-only.</p>
        </>
      )}
    </div>
  );
}
