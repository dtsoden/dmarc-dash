export interface DmarcReport {
  orgName: string;
  reporterEmail?: string;
  extraContactInfo?: string;
  reportId: string;
  dateBegin: number;
  dateEnd: number;
  error?: string;
  generator?: string;
  schemaNamespace?: string;
  sourceFilename?: string;
  rawXml?: string;
  policy: {
    domain?: string; p?: string; sp?: string; np?: string;
    adkim?: string; aspf?: string; pct?: number | null; fo?: string;
    discoveryMethod?: string; testing?: string;
  };
  records: DmarcRecord[];
  extensions?: { namespace?: string; elementName?: string; rawXml?: string }[];
}

export interface DmarcRecord {
  sourceIp?: string;
  sourceIpNorm?: string;
  count: number;
  disposition?: string;
  dkimAligned?: string;
  spfAligned?: string;
  headerFrom?: string;
  envelopeFrom?: string;
  envelopeTo?: string;
  authDkim: { domain?: string; selector?: string; result?: string; humanResult?: string }[];
  authSpf: { domain?: string; scope?: string; result?: string; humanResult?: string }[];
  reasons: { type?: string; comment?: string }[];
}
