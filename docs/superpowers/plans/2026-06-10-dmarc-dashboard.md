# DMARC Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted Next.js app that polls an Office 365 mailbox via Microsoft Graph for DMARC aggregate reports, ingests them into SQLite, and presents a modern admin dashboard.

**Architecture:** One Next.js 15 (App Router) container. An in-process `node-cron` worker authenticates app-only to Graph, downloads + decompresses + parses report attachments into a normalized SQLite schema (dedup + safe-delete), and the SSR dashboard (shadcn/ui + Recharts) reads aggregate queries behind a simple admin login.

**Tech Stack:** Next.js 15, TypeScript, better-sqlite3, fast-xml-parser, @azure/msal-node, @microsoft/microsoft-graph-client, node-cron, shadcn/ui, Tailwind, Recharts, react-simple-maps, maxmind, iron-session, vitest.

---

## Spec reference

Implements `docs/superpowers/specs/2026-06-10-dmarc-dashboard-design.md`.

## File structure

```
DMARC-DASH/
  package.json, tsconfig.json, next.config.ts, .env.example, .gitignore
  Dockerfile, docker-compose.yml, .dockerignore
  vitest.config.ts
  docs/SETUP-ENTRA.md                 # Entra app-registration walkthrough
  data/                               # mounted volume: dmarc.db, GeoLite2-City.mmdb
  src/
    lib/
      db/
        connection.ts                 # better-sqlite3 singleton
        schema.sql                    # full DDL
        migrate.ts                    # apply schema.sql idempotently
        repository.ts                 # insert report graph in one txn + dedup
        queries.ts                    # dashboard aggregate queries
      ingest/
        decompress.ts                 # magic-byte sniff: gzip/zip/plain + charset
        parse.ts                      # XML -> union DmarcReport model
        model.ts                      # TS types for the union model
        ingest.ts                     # orchestration: decompress->parse->store->log
      graph/
        auth.ts                       # MSAL client-credentials token
        client.ts                     # list inbox, get attachments, delete, move
        mailbox.ts                    # high-level: fetchReportEmails / finalize
      geo/
        geoip.ts                      # maxmind lookup + reverse-DNS/org cache
      scheduler.ts                    # node-cron registration
      auth/
        session.ts                    # iron-session config
        password.ts                   # hash/verify
      config.ts                       # env parsing/validation (zod)
    app/
      (auth)/login/page.tsx
      api/auth/login/route.ts
      api/auth/logout/route.ts
      (dashboard)/layout.tsx          # nav shell, auth guard
      (dashboard)/page.tsx            # Overview
      (dashboard)/sources/page.tsx
      (dashboard)/authentication/page.tsx
      (dashboard)/policy/page.tsx
      (dashboard)/reports/page.tsx
      (dashboard)/reports/[id]/page.tsx
      (dashboard)/ingest-log/page.tsx
      instrumentation.ts              # boots scheduler on server start
    components/                       # shadcn + chart wrappers
  tests/
    fixtures/                         # sample report files (.xml, .xml.gz, .zip)
    *.test.ts
```

---

## Milestone 0: Project scaffold

### Task 0.1: Initialize Next.js + TypeScript project

**Files:** Create `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `vitest.config.ts`

- [ ] **Step 1: Scaffold Next.js**

Run in `C:/Users/DavidSoden/DMARC-DASH`:
```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```
When prompted about the non-empty directory (`docs/`, `.git/`), choose to proceed.

- [ ] **Step 2: Add dependencies**

```bash
npm i better-sqlite3 fast-xml-parser @azure/msal-node @microsoft/microsoft-graph-client node-cron iron-session zod maxmind recharts react-simple-maps d3-geo bcryptjs
npm i -D vitest @types/better-sqlite3 @types/node-cron @types/bcryptjs @types/react-simple-maps tsx
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"], globals: true },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 4: Add scripts to `package.json`**

Add to `"scripts"`: `"test": "vitest run"`, `"test:watch": "vitest"`, `"migrate": "tsx src/lib/db/migrate.ts"`.

- [ ] **Step 5: Update `.gitignore`**

Append:
```
/data/*.db
/data/*.mmdb
.env
.env.local
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Scaffold Next.js + TS project with deps"
```

### Task 0.2: Config loader with validation

**Files:** Create `src/lib/config.ts`, `.env.example`; Test `tests/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/config.test.ts
import { describe, it, expect } from "vitest";
import { parseConfig } from "@/lib/config";

describe("parseConfig", () => {
  it("parses a full valid env", () => {
    const cfg = parseConfig({
      TENANT_ID: "t", CLIENT_ID: "c", CLIENT_SECRET: "s",
      MAILBOX_UPN: "dmarc@example.com", POLL_CRON: "*/15 * * * *",
      ADMIN_USER: "admin", ADMIN_PASSWORD_HASH: "$2a$10$abc",
      SESSION_SECRET: "x".repeat(32), DB_PATH: "data/dmarc.db", DELETE_MODE: "safe",
    });
    expect(cfg.mailboxUpn).toBe("dmarc@example.com");
    expect(cfg.deleteMode).toBe("safe");
  });

  it("rejects an invalid DELETE_MODE", () => {
    expect(() => parseConfig({ DELETE_MODE: "nuke" } as any)).toThrow();
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- tests/config.test.ts`  Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/config.ts`**

```ts
import { z } from "zod";

const Schema = z.object({
  TENANT_ID: z.string().min(1),
  CLIENT_ID: z.string().min(1),
  CLIENT_SECRET: z.string().min(1),
  MAILBOX_UPN: z.string().email(),
  POLL_CRON: z.string().default("*/15 * * * *"),
  MAXMIND_LICENSE_KEY: z.string().optional(),
  ADMIN_USER: z.string().min(1),
  ADMIN_PASSWORD_HASH: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  DB_PATH: z.string().default("data/dmarc.db"),
  DELETE_MODE: z.enum(["safe", "hard"]).default("safe"),
  MAILERSEND_API_TOKEN: z.string().optional(),
  MAILERSEND_FROM: z.string().default("dmarc@beaconspec.com"),
  DIGEST_RECIPIENTS: z.string().default("david.soden@beaconspec.com,duane.walker@beaconspec.com"),
  DIGEST_WEEKLY_CRON: z.string().default("0 8 * * 1"),
  DIGEST_MONTHLY_CRON: z.string().default("0 8 1 * *"),
});

export function parseConfig(env: NodeJS.ProcessEnv) {
  const p = Schema.parse(env);
  return {
    tenantId: p.TENANT_ID, clientId: p.CLIENT_ID, clientSecret: p.CLIENT_SECRET,
    mailboxUpn: p.MAILBOX_UPN, pollCron: p.POLL_CRON, maxmindKey: p.MAXMIND_LICENSE_KEY,
    adminUser: p.ADMIN_USER, adminPasswordHash: p.ADMIN_PASSWORD_HASH,
    sessionSecret: p.SESSION_SECRET, dbPath: p.DB_PATH, deleteMode: p.DELETE_MODE,
    mailersendToken: p.MAILERSEND_API_TOKEN, mailersendFrom: p.MAILERSEND_FROM,
    digestRecipients: p.DIGEST_RECIPIENTS.split(",").map((s) => s.trim()).filter(Boolean),
    digestWeeklyCron: p.DIGEST_WEEKLY_CRON, digestMonthlyCron: p.DIGEST_MONTHLY_CRON,
  };
}

let cached: ReturnType<typeof parseConfig> | null = null;
export function config() {
  if (!cached) cached = parseConfig(process.env);
  return cached;
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- tests/config.test.ts`  Expected: PASS (both tests).

- [ ] **Step 5: Write `.env.example`**

```
TENANT_ID=
CLIENT_ID=
CLIENT_SECRET=
MAILBOX_UPN=dmarc@yourdomain.com
POLL_CRON=*/15 * * * *
MAXMIND_LICENSE_KEY=
ADMIN_USER=admin
ADMIN_PASSWORD_HASH=
SESSION_SECRET=
DB_PATH=data/dmarc.db
DELETE_MODE=safe
MAILERSEND_API_TOKEN=
MAILERSEND_FROM=dmarc@beaconspec.com
DIGEST_RECIPIENTS=david.soden@beaconspec.com,duane.walker@beaconspec.com
DIGEST_WEEKLY_CRON=0 8 * * 1
DIGEST_MONTHLY_CRON=0 8 1 * *
```

- [ ] **Step 6: Update the config test to cover digest fields**

Append to `tests/config.test.ts` inside the existing `describe`:
```ts
  it("splits DIGEST_RECIPIENTS into a trimmed array with defaults", () => {
    const cfg = parseConfig({
      TENANT_ID: "t", CLIENT_ID: "c", CLIENT_SECRET: "s",
      MAILBOX_UPN: "dmarc@example.com", ADMIN_USER: "admin",
      ADMIN_PASSWORD_HASH: "$2a$10$abc", SESSION_SECRET: "x".repeat(32),
    } as any);
    expect(cfg.digestRecipients).toEqual(["david.soden@beaconspec.com", "duane.walker@beaconspec.com"]);
    expect(cfg.digestWeeklyCron).toBe("0 8 * * 1");
  });
```
Run: `npm test -- tests/config.test.ts`  Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "Add validated config loader with digest settings"
```

---

## Milestone 1: Database schema + repository

### Task 1.1: Schema DDL + migration

**Files:** Create `src/lib/db/schema.sql`, `src/lib/db/connection.ts`, `src/lib/db/migrate.ts`; Test `tests/migrate.test.ts`

- [ ] **Step 1: Write `src/lib/db/schema.sql`**

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS report (
  id INTEGER PRIMARY KEY,
  org_name TEXT NOT NULL,
  reporter_email TEXT,
  extra_contact_info TEXT,
  report_id TEXT NOT NULL,
  date_begin INTEGER NOT NULL,
  date_end INTEGER NOT NULL,
  error TEXT,
  generator TEXT,
  schema_namespace TEXT,
  source_filename TEXT,
  raw_xml TEXT,
  ingested_at INTEGER NOT NULL,
  UNIQUE (org_name, report_id, date_begin, date_end)
);

CREATE TABLE IF NOT EXISTS policy_published (
  report_id INTEGER PRIMARY KEY REFERENCES report(id) ON DELETE CASCADE,
  domain TEXT, p TEXT, sp TEXT, np TEXT, adkim TEXT, aspf TEXT,
  pct INTEGER, fo TEXT, discovery_method TEXT, testing TEXT
);

CREATE TABLE IF NOT EXISTS record (
  id INTEGER PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES report(id) ON DELETE CASCADE,
  source_ip TEXT, source_ip_norm TEXT, count INTEGER NOT NULL DEFAULT 0,
  disposition TEXT, dkim_aligned TEXT, spf_aligned TEXT,
  header_from TEXT, envelope_from TEXT, envelope_to TEXT
);

CREATE TABLE IF NOT EXISTS auth_result_dkim (
  id INTEGER PRIMARY KEY,
  record_id INTEGER NOT NULL REFERENCES record(id) ON DELETE CASCADE,
  domain TEXT, selector TEXT, result TEXT, human_result TEXT
);

CREATE TABLE IF NOT EXISTS auth_result_spf (
  id INTEGER PRIMARY KEY,
  record_id INTEGER NOT NULL REFERENCES record(id) ON DELETE CASCADE,
  domain TEXT, scope TEXT, result TEXT, human_result TEXT
);

CREATE TABLE IF NOT EXISTS policy_override_reason (
  id INTEGER PRIMARY KEY,
  record_id INTEGER NOT NULL REFERENCES record(id) ON DELETE CASCADE,
  type TEXT, comment TEXT
);

CREATE TABLE IF NOT EXISTS report_extension (
  id INTEGER PRIMARY KEY,
  report_id INTEGER REFERENCES report(id) ON DELETE CASCADE,
  record_id INTEGER REFERENCES record(id) ON DELETE CASCADE,
  namespace TEXT, element_name TEXT, raw_xml TEXT
);

CREATE TABLE IF NOT EXISTS ingest_log (
  id INTEGER PRIMARY KEY,
  filename TEXT, reporter TEXT, status TEXT NOT NULL,
  records_ingested INTEGER DEFAULT 0,
  dropped_fields TEXT, message_id TEXT, error_detail TEXT,
  processed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_record_report ON record(report_id);
CREATE INDEX IF NOT EXISTS idx_record_srcip ON record(source_ip_norm);
CREATE INDEX IF NOT EXISTS idx_record_headerfrom ON record(header_from);
CREATE INDEX IF NOT EXISTS idx_report_dates ON report(date_begin, date_end);
CREATE INDEX IF NOT EXISTS idx_pp_domain ON policy_published(domain);
```

- [ ] **Step 2: Implement `src/lib/db/connection.ts`**

```ts
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

let db: Database.Database | null = null;

export function getDb(dbPath = process.env.DB_PATH ?? "data/dmarc.db") {
  if (db) return db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function closeDb() { db?.close(); db = null; }
```

- [ ] **Step 3: Implement `src/lib/db/migrate.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./connection";

export function migrate(dbPath?: string) {
  const db = getDb(dbPath);
  const sql = fs.readFileSync(path.join(process.cwd(), "src/lib/db/schema.sql"), "utf8");
  db.exec(sql);
  return db;
}

if (require.main === module) { migrate(); console.log("Migrated."); }
```

- [ ] **Step 4: Write `tests/migrate.test.ts`**

```ts
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { migrate } from "@/lib/db/migrate";
import { closeDb } from "@/lib/db/connection";

const TMP = "data/test-migrate.db";
afterEach(() => { closeDb(); fs.rmSync(TMP, { force: true }); fs.rmSync(TMP + "-wal", { force: true }); fs.rmSync(TMP + "-shm", { force: true }); });

describe("migrate", () => {
  it("creates all tables", () => {
    const db = migrate(TMP);
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    for (const t of ["report","policy_published","record","auth_result_dkim","auth_result_spf","policy_override_reason","report_extension","ingest_log"])
      expect(names).toContain(t);
  });
});
```

- [ ] **Step 5: Run test, expect PASS**

Run: `npm test -- tests/migrate.test.ts`  Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add SQLite schema and migration"
```

### Task 1.2: Repository — insert report graph with dedup

**Files:** Create `src/lib/ingest/model.ts`, `src/lib/db/repository.ts`; Test `tests/repository.test.ts`

- [ ] **Step 1: Define the union model `src/lib/ingest/model.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing test `tests/repository.test.ts`**

```ts
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { migrate } from "@/lib/db/migrate";
import { closeDb, getDb } from "@/lib/db/connection";
import { insertReport } from "@/lib/db/repository";
import type { DmarcReport } from "@/lib/ingest/model";

const TMP = "data/test-repo.db";
afterEach(() => { closeDb(); for (const s of ["","-wal","-shm"]) fs.rmSync(TMP+s, { force: true }); });

function sample(): DmarcReport {
  return {
    orgName: "google.com", reportId: "R1", dateBegin: 100, dateEnd: 200,
    policy: { domain: "example.com", p: "reject", adkim: "r", aspf: "r" },
    records: [{
      sourceIp: "1.2.3.4", sourceIpNorm: "1.2.3.4", count: 5,
      disposition: "none", dkimAligned: "pass", spfAligned: "fail",
      headerFrom: "example.com",
      authDkim: [{ domain: "example.com", selector: "s1", result: "pass" }],
      authSpf: [{ domain: "example.com", scope: "mfrom", result: "fail" }],
      reasons: [{ type: "forwarded" }],
    }],
  };
}

describe("insertReport", () => {
  it("inserts the full graph and returns inserted=true", () => {
    migrate(TMP);
    const r = insertReport(sample());
    expect(r.inserted).toBe(true);
    const db = getDb(TMP);
    expect((db.prepare("SELECT COUNT(*) c FROM record").get() as any).c).toBe(1);
    expect((db.prepare("SELECT COUNT(*) c FROM auth_result_dkim").get() as any).c).toBe(1);
    expect((db.prepare("SELECT SUM(count) s FROM record").get() as any).s).toBe(5);
  });

  it("dedups on (org_name, report_id, date_begin, date_end)", () => {
    migrate(TMP);
    insertReport(sample());
    const second = insertReport(sample());
    expect(second.inserted).toBe(false);
    const db = getDb(TMP);
    expect((db.prepare("SELECT COUNT(*) c FROM report").get() as any).c).toBe(1);
  });
});
```

- [ ] **Step 3: Run test, expect FAIL**

Run: `npm test -- tests/repository.test.ts`  Expected: FAIL (insertReport not defined).

- [ ] **Step 4: Implement `src/lib/db/repository.ts`**

```ts
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
```

- [ ] **Step 5: Run test, expect PASS**

Run: `npm test -- tests/repository.test.ts`  Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add repository with dedup insert of report graph"
```

---

## Milestone 2: Decompression

### Task 2.1: Magic-byte decompression + charset decode

**Files:** Create `src/lib/ingest/decompress.ts`; Test `tests/decompress.test.ts`; Fixtures generated in test.

- [ ] **Step 1: Write the failing test `tests/decompress.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import { decompressToXml } from "@/lib/ingest/decompress";

const XML = `<?xml version="1.0"?><feedback><report_metadata><org_name>x</org_name></report_metadata></feedback>`;

describe("decompressToXml", () => {
  it("passes through plain xml bytes", () => {
    expect(decompressToXml(Buffer.from(XML, "utf8"), "r.xml")).toContain("<feedback>");
  });
  it("inflates gzip", () => {
    const gz = zlib.gzipSync(Buffer.from(XML, "utf8"));
    expect(decompressToXml(gz, "r.xml.gz")).toContain("<org_name>x</org_name>");
  });
  it("extracts first xml entry from a zip", () => {
    // minimal zip via zlib deflateRaw + manual local header is complex; use a real zip lib path.
    // Build a zip using the same code path the impl uses (adm-zip) to keep the test honest.
    const AdmZip = require("adm-zip");
    const z = new AdmZip();
    z.addFile("report.xml", Buffer.from(XML, "utf8"));
    expect(decompressToXml(z.toBuffer(), "r.zip")).toContain("<feedback>");
  });
});
```

- [ ] **Step 2: Add the zip dependency**

```bash
npm i adm-zip && npm i -D @types/adm-zip
```

- [ ] **Step 3: Run test, expect FAIL**

Run: `npm test -- tests/decompress.test.ts`  Expected: FAIL (decompressToXml not defined).

- [ ] **Step 4: Implement `src/lib/ingest/decompress.ts`**

```ts
import zlib from "node:zlib";
import AdmZip from "adm-zip";

function isGzip(b: Buffer) { return b.length > 2 && b[0] === 0x1f && b[1] === 0x8b; }
function isZip(b: Buffer) { return b.length > 3 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05); }

function decodeText(buf: Buffer): string {
  // DMARC XML is ASCII/UTF-8 in practice; strip a UTF-8 BOM, fall back to latin1 on invalid UTF-8.
  let s = buf.toString("utf8");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  if (s.includes("�")) s = buf.toString("latin1");
  return s;
}

export function decompressToXml(buf: Buffer, filename = ""): string {
  if (isGzip(buf)) return decodeText(zlib.gunzipSync(buf));
  if (isZip(buf)) {
    const zip = new AdmZip(buf);
    const entry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith(".xml"))
      ?? zip.getEntries().find((e) => !e.isDirectory);
    if (!entry) throw new Error(`zip ${filename} has no usable entry`);
    return decodeText(entry.getData());
  }
  return decodeText(buf);
}
```

- [ ] **Step 5: Run test, expect PASS**

Run: `npm test -- tests/decompress.test.ts`  Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add magic-byte decompression (gzip/zip/plain)"
```

---

## Milestone 3: XML parser → union model

### Task 3.1: Add real-world fixtures

**Files:** Create `tests/fixtures/google.xml`, `tests/fixtures/microsoft.xml`, `tests/fixtures/rfc9990.xml`

- [ ] **Step 1: Create `tests/fixtures/google.xml`** (legacy namespace, single record, multiple dkim)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feedback>
  <report_metadata>
    <org_name>google.com</org_name>
    <email>noreply-dmarc-support@google.com</email>
    <report_id>12345678901234567890</report_id>
    <date_range><begin>1717200000</begin><end>1717286400</end></date_range>
  </report_metadata>
  <policy_published>
    <domain>example.com</domain><adkim>r</adkim><aspf>r</aspf>
    <p>reject</p><sp>reject</sp><pct>100</pct>
  </policy_published>
  <record>
    <row>
      <source_ip>209.85.220.41</source_ip><count>2</count>
      <policy_evaluated><disposition>none</disposition><dkim>pass</dkim><spf>fail</spf></policy_evaluated>
    </row>
    <identifiers><header_from>example.com</header_from></identifiers>
    <auth_results>
      <dkim><domain>example.com</domain><selector>s1</selector><result>pass</result></dkim>
      <dkim><domain>example.com</domain><selector>s2</selector><result>fail</result></dkim>
      <spf><domain>example.com</domain><scope>mfrom</scope><result>fail</result></spf>
    </auth_results>
  </record>
</feedback>
```

- [ ] **Step 2: Create `tests/fixtures/microsoft.xml`** (single record, single dkim, override reason, no XML declaration to mimic MS quirk)

```xml
<feedback>
  <report_metadata>
    <org_name>Enterprise Outlook</org_name>
    <email>dmarcreport@microsoft.com</email>
    <report_id>abc-123</report_id>
    <date_range><begin>1717200000</begin><end>1717286400</end></date_range>
  </report_metadata>
  <policy_published>
    <domain>example.com</domain><adkim>s</adkim><aspf>s</aspf><p>quarantine</p><pct>100</pct>
  </policy_published>
  <record>
    <row>
      <source_ip>40.92.0.1</source_ip><count>7</count>
      <policy_evaluated>
        <disposition>quarantine</disposition><dkim>fail</dkim><spf>fail</spf>
        <reason><type>mailing_list</type><comment>list</comment></reason>
      </policy_evaluated>
    </row>
    <identifiers><header_from>example.com</header_from><envelope_from>example.com</envelope_from></identifiers>
    <auth_results>
      <dkim><domain>example.com</domain><result>fail</result></dkim>
      <spf><domain>example.com</domain><scope>mfrom</scope><result>fail</result></spf>
    </auth_results>
  </record>
</feedback>
```

- [ ] **Step 3: Create `tests/fixtures/rfc9990.xml`** (new namespace, `np`/`testing`, disposition `pass`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feedback xmlns="urn:ietf:params:xml:ns:dmarc-2.0">
  <version>1.0</version>
  <report_metadata>
    <org_name>yahoo.com</org_name>
    <email>dmarchelp@yahoo.com</email>
    <report_id>yh-9990-1</report_id>
    <date_range><begin>1717200000</begin><end>1717286400</end></date_range>
    <generator>Yahoo DMARC 2.0</generator>
  </report_metadata>
  <policy_published>
    <domain>example.com</domain><p>reject</p><sp>reject</sp><np>reject</np>
    <adkim>r</adkim><aspf>r</aspf><discovery_method>treewalk</discovery_method><testing>n</testing>
  </policy_published>
  <record>
    <row>
      <source_ip>2001:4860:4860::8888</source_ip><count>3</count>
      <policy_evaluated><disposition>pass</disposition><dkim>pass</dkim><spf>pass</spf></policy_evaluated>
    </row>
    <identifiers><header_from>example.com</header_from></identifiers>
    <auth_results>
      <dkim><domain>example.com</domain><selector>sel</selector><result>pass</result></dkim>
      <spf><domain>example.com</domain><result>pass</result></spf>
    </auth_results>
  </record>
</feedback>
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Add DMARC report fixtures (google/microsoft/rfc9990)"
```

### Task 3.2: Parser implementation

**Files:** Create `src/lib/ingest/parse.ts`; Test `tests/parse.test.ts`

- [ ] **Step 1: Write the failing test `tests/parse.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { parseDmarcXml } from "@/lib/ingest/parse";

const read = (f: string) => fs.readFileSync(`tests/fixtures/${f}`, "utf8");

describe("parseDmarcXml", () => {
  it("parses legacy google report with multiple dkim results", () => {
    const r = parseDmarcXml(read("google.xml"), "google.xml");
    expect(r.orgName).toBe("google.com");
    expect(r.reportId).toBe("12345678901234567890");
    expect(r.dateBegin).toBe(1717200000);
    expect(r.policy.p).toBe("reject");
    expect(r.policy.pct).toBe(100);
    expect(r.records).toHaveLength(1);
    expect(r.records[0].count).toBe(2);
    expect(r.records[0].dkimAligned).toBe("pass");
    expect(r.records[0].spfAligned).toBe("fail");
    expect(r.records[0].authDkim).toHaveLength(2);
    expect(r.records[0].authSpf).toHaveLength(1);
  });

  it("parses microsoft report lacking xml declaration, with override reason", () => {
    const r = parseDmarcXml(read("microsoft.xml"), "microsoft.xml");
    expect(r.orgName).toBe("Enterprise Outlook");
    expect(r.records[0].count).toBe(7);
    expect(r.records[0].reasons[0].type).toBe("mailing_list");
    expect(r.records[0].authDkim).toHaveLength(1);
  });

  it("parses rfc9990 report with np/testing/generator and disposition pass", () => {
    const r = parseDmarcXml(read("rfc9990.xml"), "rfc9990.xml");
    expect(r.schemaNamespace).toBe("urn:ietf:params:xml:ns:dmarc-2.0");
    expect(r.generator).toBe("Yahoo DMARC 2.0");
    expect(r.policy.np).toBe("reject");
    expect(r.policy.testing).toBe("n");
    expect(r.policy.discoveryMethod).toBe("treewalk");
    expect(r.records[0].disposition).toBe("pass");
    expect(r.records[0].sourceIp).toBe("2001:4860:4860::8888");
  });

  it("normalizes source_ip", () => {
    const r = parseDmarcXml(read("google.xml"), "google.xml");
    expect(r.records[0].sourceIpNorm).toBe("209.85.220.41");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- tests/parse.test.ts`  Expected: FAIL (parseDmarcXml not defined).

- [ ] **Step 3: Implement `src/lib/ingest/parse.ts`**

```ts
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
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- tests/parse.test.ts`  Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add DMARC XML parser to union model"
```

### Task 3.3: Capture unknown/extension fields into dropped_fields

**Files:** Modify `src/lib/ingest/parse.ts`; Test add to `tests/parse.test.ts`

- [ ] **Step 1: Write the failing test (append to `tests/parse.test.ts`)**

```ts
import { collectUnknownFields } from "@/lib/ingest/parse";

describe("collectUnknownFields", () => {
  it("reports unknown elements under known parents", () => {
    const xml = `<feedback><report_metadata><org_name>x</org_name><weird_field>v</weird_field></report_metadata>
      <policy_published><domain>d</domain></policy_published>
      <record><row><source_ip>1.1.1.1</source_ip><count>1</count><mystery>1</mystery></row></record></feedback>`;
    const unknown = collectUnknownFields(xml);
    expect(unknown).toContain("report_metadata.weird_field");
    expect(unknown).toContain("record.row.mystery");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- tests/parse.test.ts`  Expected: FAIL (collectUnknownFields not defined).

- [ ] **Step 3: Implement `collectUnknownFields` in `src/lib/ingest/parse.ts`**

```ts
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
  const out: string[] = [];
  const walk = (node: any, parentName: string, pathPrefix: string) => {
    if (node === null || typeof node !== "object") return;
    const known = KNOWN[parentName];
    for (const key of Object.keys(node)) {
      if (key.startsWith("@_") && parentName !== "feedback") { continue; }
      const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      if (known && !known.has(key)) out.push(childPath);
      const children = Array.isArray(node[key]) ? node[key] : [node[key]];
      for (const c of children) walk(c, key, childPath);
    }
  };
  walk(doc.feedback, "feedback", "record" in (doc.feedback ?? {}) ? "" : "");
  // Re-walk with proper top label so paths read naturally:
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
```

(Note: keep only the `walk2` version — delete the first `walk`/`out` scaffold so the function body is just the `walk2` definition, the call `walk2(doc.feedback,"feedback","")`, and `return Array.from(new Set(result))`.)

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- tests/parse.test.ts`  Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Capture unknown DMARC fields for drop logging"
```

---

## Milestone 4: Ingest orchestration

### Task 4.1: Ingest one attachment end-to-end

**Files:** Create `src/lib/ingest/ingest.ts`; Test `tests/ingest.test.ts`

- [ ] **Step 1: Write the failing test `tests/ingest.test.ts`**

```ts
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import zlib from "node:zlib";
import { migrate } from "@/lib/db/migrate";
import { closeDb, getDb } from "@/lib/db/connection";
import { ingestAttachment } from "@/lib/ingest/ingest";

const TMP = "data/test-ingest.db";
afterEach(() => { closeDb(); for (const s of ["","-wal","-shm"]) fs.rmSync(TMP+s,{force:true}); });

describe("ingestAttachment", () => {
  it("ingests a gzipped report and logs success", () => {
    migrate(TMP);
    const xml = fs.readFileSync("tests/fixtures/google.xml");
    const gz = zlib.gzipSync(xml);
    const res = ingestAttachment(gz, "google.xml.gz", "msg-1", TMP);
    expect(res.status).toBe("ingested");
    expect(res.recordsIngested).toBe(1);
    const db = getDb(TMP);
    expect((db.prepare("SELECT COUNT(*) c FROM report").get() as any).c).toBe(1);
    expect((db.prepare("SELECT status FROM ingest_log").get() as any).status).toBe("ingested");
  });

  it("marks duplicate on second ingest", () => {
    migrate(TMP);
    const xml = fs.readFileSync("tests/fixtures/google.xml");
    ingestAttachment(xml, "g.xml", "m1", TMP);
    const res = ingestAttachment(xml, "g.xml", "m2", TMP);
    expect(res.status).toBe("duplicate");
  });

  it("logs failed status and does not throw on garbage", () => {
    migrate(TMP);
    const res = ingestAttachment(Buffer.from("not xml at all"), "bad.xml", "m3", TMP);
    expect(res.status).toBe("failed");
    const db = getDb(TMP);
    expect((db.prepare("SELECT status FROM ingest_log WHERE message_id='m3'").get() as any).status).toBe("failed");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- tests/ingest.test.ts`  Expected: FAIL (ingestAttachment not defined).

- [ ] **Step 3: Implement `src/lib/ingest/ingest.ts`**

```ts
import { getDb } from "@/lib/db/connection";
import { insertReport } from "@/lib/db/repository";
import { decompressToXml } from "./decompress";
import { parseDmarcXml, collectUnknownFields } from "./parse";

export type IngestStatus = "ingested" | "duplicate" | "failed";
export interface IngestResult { status: IngestStatus; recordsIngested: number; error?: string; }

function logIngest(dbPath: string | undefined, row: {
  filename: string; reporter: string | null; status: IngestStatus;
  records: number; dropped: string[]; messageId: string; error?: string;
}) {
  getDb(dbPath).prepare(
    `INSERT INTO ingest_log (filename,reporter,status,records_ingested,dropped_fields,message_id,error_detail,processed_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(row.filename, row.reporter, row.status, row.records,
    row.dropped.length ? JSON.stringify(row.dropped) : null, row.messageId,
    row.error ?? null, Math.floor(Date.now() / 1000));
}

export function ingestAttachment(buf: Buffer, filename: string, messageId: string, dbPath?: string): IngestResult {
  try {
    const xml = decompressToXml(buf, filename);
    const report = parseDmarcXml(xml, filename);
    const dropped = collectUnknownFields(xml);
    const { inserted } = insertReport(report, dbPath);
    const status: IngestStatus = inserted ? "ingested" : "duplicate";
    const records = inserted ? report.records.length : 0;
    logIngest(dbPath, { filename, reporter: report.orgName, status, records, dropped, messageId });
    return { status, recordsIngested: records };
  } catch (e: any) {
    logIngest(dbPath, { filename, reporter: null, status: "failed", records: 0, dropped: [], messageId, error: String(e?.message ?? e) });
    return { status: "failed", recordsIngested: 0, error: String(e?.message ?? e) };
  }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- tests/ingest.test.ts`  Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add end-to-end attachment ingest with logging"
```

---

## Milestone 5: Microsoft Graph mailbox client

> These tasks talk to a live API. Unit-test the pure helpers; the network methods are validated manually against the real mailbox in Task 5.4 and via the scheduler in Milestone 6.

### Task 5.1: MSAL app-only token

**Files:** Create `src/lib/graph/auth.ts`; Test `tests/graph-auth.test.ts`

- [ ] **Step 1: Write the failing test (guards token caching logic)**

```ts
import { describe, it, expect, vi } from "vitest";
import { GraphAuth } from "@/lib/graph/auth";

describe("GraphAuth", () => {
  it("requests a token and caches it until near expiry", async () => {
    const acquire = vi.fn().mockResolvedValue({ accessToken: "tok", expiresOn: new Date(Date.now() + 3600_000) });
    const auth = new GraphAuth({ tenantId: "t", clientId: "c", clientSecret: "s" }, { acquireTokenByClientCredential: acquire } as any);
    expect(await auth.getToken()).toBe("tok");
    expect(await auth.getToken()).toBe("tok");
    expect(acquire).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- tests/graph-auth.test.ts`  Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/graph/auth.ts`**

```ts
import { ConfidentialClientApplication } from "@azure/msal-node";

interface AuthCfg { tenantId: string; clientId: string; clientSecret: string; }
interface CcaLike { acquireTokenByClientCredential(req: { scopes: string[] }): Promise<{ accessToken: string; expiresOn?: Date | null } | null>; }

export class GraphAuth {
  private token: string | null = null;
  private expiresAt = 0;
  constructor(private cfg: AuthCfg, private cca?: CcaLike) {
    if (!this.cca) {
      this.cca = new ConfidentialClientApplication({
        auth: { clientId: cfg.clientId, authority: `https://login.microsoftonline.com/${cfg.tenantId}`, clientSecret: cfg.clientSecret },
      });
    }
  }
  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.expiresAt - 60_000) return this.token;
    const res = await this.cca!.acquireTokenByClientCredential({ scopes: ["https://graph.microsoft.com/.default"] });
    if (!res?.accessToken) throw new Error("Failed to acquire Graph token");
    this.token = res.accessToken;
    this.expiresAt = res.expiresOn ? res.expiresOn.getTime() : now + 3000_000;
    return this.token;
  }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- tests/graph-auth.test.ts`  Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add MSAL app-only token provider"
```

### Task 5.2: Graph client (list, attachments, delete, move)

**Files:** Create `src/lib/graph/client.ts`

- [ ] **Step 1: Implement `src/lib/graph/client.ts`**

```ts
import { Client } from "@microsoft/microsoft-graph-client";
import type { GraphAuth } from "./auth";

export interface MailMessage { id: string; subject?: string; hasAttachments?: boolean; }
export interface FileAttachment { id: string; name: string; contentBytes: string; contentType?: string; }

export class GraphClient {
  private client: Client;
  constructor(private auth: GraphAuth, private mailboxUpn: string) {
    this.client = Client.init({
      authProvider: async (done) => {
        try { done(null, await this.auth.getToken()); } catch (e) { done(e as Error, null); }
      },
    });
  }

  private base() { return `/users/${encodeURIComponent(this.mailboxUpn)}`; }

  async listInbox(top = 50): Promise<MailMessage[]> {
    const res = await this.client.api(`${this.base()}/mailFolders/inbox/messages`)
      .select("id,subject,hasAttachments").top(top).get();
    return res.value as MailMessage[];
  }

  async getFileAttachments(messageId: string): Promise<FileAttachment[]> {
    const res = await this.client.api(`${this.base()}/messages/${messageId}/attachments`).get();
    return (res.value as any[])
      .filter((a) => a["@odata.type"] === "#microsoft.graph.fileAttachment")
      .map((a) => ({ id: a.id, name: a.name, contentBytes: a.contentBytes, contentType: a.contentType }));
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.client.api(`${this.base()}/messages/${messageId}`).delete();
  }

  async ensureFolder(displayName: string): Promise<string> {
    const existing = await this.client.api(`${this.base()}/mailFolders`)
      .filter(`displayName eq '${displayName.replace(/'/g, "''")}'`).get();
    if (existing.value?.length) return existing.value[0].id;
    const created = await this.client.api(`${this.base()}/mailFolders`).post({ displayName });
    return created.id;
  }

  async moveMessage(messageId: string, destinationFolderId: string): Promise<void> {
    await this.client.api(`${this.base()}/messages/${messageId}/move`).post({ destinationId: destinationFolderId });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`  Expected: no errors in `client.ts`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add Microsoft Graph mailbox client"
```

### Task 5.3: Mailbox orchestration (fetch → ingest → finalize)

**Files:** Create `src/lib/graph/mailbox.ts`; Test `tests/mailbox.test.ts`

- [ ] **Step 1: Write the failing test (mock GraphClient + ingest, assert finalize logic)**

```ts
import { describe, it, expect, vi } from "vitest";
import { processMailbox } from "@/lib/graph/mailbox";

function fakeClient(over: Partial<any> = {}) {
  return {
    listInbox: vi.fn().mockResolvedValue([{ id: "m1", hasAttachments: true }]),
    getFileAttachments: vi.fn().mockResolvedValue([{ id: "a1", name: "r.xml.gz", contentBytes: Buffer.from("X").toString("base64") }]),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    ensureFolder: vi.fn().mockResolvedValue("err-folder"),
    moveMessage: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("processMailbox", () => {
  it("deletes the email when all attachments ingest (safe mode)", async () => {
    const c = fakeClient();
    const ingest = vi.fn().mockReturnValue({ status: "ingested", recordsIngested: 1 });
    await processMailbox(c as any, { deleteMode: "safe" }, ingest);
    expect(c.deleteMessage).toHaveBeenCalledWith("m1");
    expect(c.moveMessage).not.toHaveBeenCalled();
  });

  it("deletes the email on duplicate too", async () => {
    const c = fakeClient();
    const ingest = vi.fn().mockReturnValue({ status: "duplicate", recordsIngested: 0 });
    await processMailbox(c as any, { deleteMode: "safe" }, ingest);
    expect(c.deleteMessage).toHaveBeenCalledWith("m1");
  });

  it("moves to errors folder on failure in safe mode, does not delete", async () => {
    const c = fakeClient();
    const ingest = vi.fn().mockReturnValue({ status: "failed", recordsIngested: 0 });
    await processMailbox(c as any, { deleteMode: "safe" }, ingest);
    expect(c.deleteMessage).not.toHaveBeenCalled();
    expect(c.moveMessage).toHaveBeenCalledWith("m1", "err-folder");
  });

  it("hard mode deletes even on failure", async () => {
    const c = fakeClient();
    const ingest = vi.fn().mockReturnValue({ status: "failed", recordsIngested: 0 });
    await processMailbox(c as any, { deleteMode: "hard" }, ingest);
    expect(c.deleteMessage).toHaveBeenCalledWith("m1");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- tests/mailbox.test.ts`  Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/graph/mailbox.ts`**

```ts
import type { GraphClient } from "./client";
import type { IngestResult } from "@/lib/ingest/ingest";
import { ingestAttachment } from "@/lib/ingest/ingest";

type IngestFn = (buf: Buffer, filename: string, messageId: string, dbPath?: string) => IngestResult;

const ERROR_FOLDER = "DMARC-Errors";

export async function processMailbox(
  client: GraphClient,
  opts: { deleteMode: "safe" | "hard"; dbPath?: string },
  ingest: IngestFn = ingestAttachment,
): Promise<{ processed: number; ingested: number; failed: number; duplicates: number }> {
  const messages = await client.listInbox();
  let ingested = 0, failed = 0, duplicates = 0;

  for (const msg of messages) {
    const attachments = await client.getFileAttachments(msg.id);
    let anyFailed = false, anySuccess = false;
    for (const att of attachments) {
      const buf = Buffer.from(att.contentBytes, "base64");
      const res = ingest(buf, att.name, msg.id, opts.dbPath);
      if (res.status === "ingested") { ingested++; anySuccess = true; }
      else if (res.status === "duplicate") { duplicates++; anySuccess = true; }
      else { failed++; anyFailed = true; }
    }

    const cleanlyHandled = attachments.length > 0 && !anyFailed;
    if (cleanlyHandled || opts.deleteMode === "hard") {
      await client.deleteMessage(msg.id);
    } else {
      const folderId = await client.ensureFolder(ERROR_FOLDER);
      await client.moveMessage(msg.id, folderId);
    }
    void anySuccess;
  }
  return { processed: messages.length, ingested, failed, duplicates };
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- tests/mailbox.test.ts`  Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add mailbox orchestration with safe-delete/move logic"
```

### Task 5.4: Manual smoke test against live mailbox (after Entra setup)

**Files:** Create `scripts/poll-once.ts`

- [ ] **Step 1: Implement `scripts/poll-once.ts`**

```ts
import "dotenv/config";
import { migrate } from "@/lib/db/migrate";
import { config } from "@/lib/config";
import { GraphAuth } from "@/lib/graph/auth";
import { GraphClient } from "@/lib/graph/client";
import { processMailbox } from "@/lib/graph/mailbox";

(async () => {
  migrate();
  const cfg = config();
  const auth = new GraphAuth({ tenantId: cfg.tenantId, clientId: cfg.clientId, clientSecret: cfg.clientSecret });
  const client = new GraphClient(auth, cfg.mailboxUpn);
  const result = await processMailbox(client, { deleteMode: cfg.deleteMode, dbPath: cfg.dbPath });
  console.log("Poll result:", result);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add `dotenv` dev dep and script**

```bash
npm i -D dotenv
```
Add to `package.json` scripts: `"poll:once": "tsx scripts/poll-once.ts"`.

- [ ] **Step 3: Run after `.env` is filled (manual, post Entra setup in Milestone 10)**

Run: `npm run poll:once`  Expected: prints a result object; verify rows appear in `data/dmarc.db`. Document this step in `docs/SETUP-ENTRA.md`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Add one-shot poll script for live smoke test"
```

---

## Milestone 6: Scheduler

### Task 6.1: node-cron scheduler + server boot hook

**Files:** Create `src/lib/scheduler.ts`, `src/app/instrumentation.ts`

- [ ] **Step 1: Implement `src/lib/scheduler.ts`**

```ts
import cron from "node-cron";
import { migrate } from "@/lib/db/migrate";
import { config } from "@/lib/config";
import { GraphAuth } from "@/lib/graph/auth";
import { GraphClient } from "@/lib/graph/client";
import { processMailbox } from "@/lib/graph/mailbox";

let started = false;
let running = false;

export async function runPollOnce() {
  if (running) { console.log("[poll] previous run still in progress, skipping"); return; }
  running = true;
  try {
    const cfg = config();
    const auth = new GraphAuth({ tenantId: cfg.tenantId, clientId: cfg.clientId, clientSecret: cfg.clientSecret });
    const client = new GraphClient(auth, cfg.mailboxUpn);
    const res = await processMailbox(client, { deleteMode: cfg.deleteMode, dbPath: cfg.dbPath });
    console.log(`[poll] ${new Date().toISOString()}`, res);
  } catch (e) {
    console.error("[poll] error:", e);
  } finally {
    running = false;
  }
}

export function startScheduler() {
  if (started) return;
  started = true;
  migrate();
  const cfg = config();
  if (!cron.validate(cfg.pollCron)) throw new Error(`Invalid POLL_CRON: ${cfg.pollCron}`);
  cron.schedule(cfg.pollCron, () => { void runPollOnce(); });
  console.log(`[scheduler] started with cron "${cfg.pollCron}"`);
}
```

- [ ] **Step 2: Implement `src/app/instrumentation.ts`**

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}
```

- [ ] **Step 3: Enable instrumentation in `next.config.ts`**

Ensure `next.config.ts` contains (Next 15 has instrumentation on by default; set serverExternalPackages for native sqlite):
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};
export default nextConfig;
```

- [ ] **Step 4: Verify it boots**

Run: `npm run dev`  Expected: console shows `[scheduler] started with cron "*/15 * * * *"` (with a filled `.env.local`). Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add in-process cron scheduler booted via instrumentation"
```

---

## Milestone 7: Authentication (admin login)

### Task 7.1: Password hashing + session config

**Files:** Create `src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `scripts/hash-password.ts`; Test `tests/password.test.ts`

- [ ] **Step 1: Write the failing test `tests/password.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("hashes and verifies", () => {
    const h = hashPassword("s3cret");
    expect(verifyPassword("s3cret", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- tests/password.test.ts`  Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/auth/password.ts`**

```ts
import bcrypt from "bcryptjs";
export function hashPassword(plain: string): string { return bcrypt.hashSync(plain, 10); }
export function verifyPassword(plain: string, hash: string): boolean {
  try { return bcrypt.compareSync(plain, hash); } catch { return false; }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- tests/password.test.ts`  Expected: PASS.

- [ ] **Step 5: Implement `src/lib/auth/session.ts`**

```ts
import type { SessionOptions } from "iron-session";

export interface SessionData { user?: string; loggedIn: boolean; }

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me-32x",
  cookieName: "dmarc_session",
  cookieOptions: { secure: process.env.NODE_ENV === "production", httpOnly: true, sameSite: "lax" },
};
```

- [ ] **Step 6: Implement `scripts/hash-password.ts`** (admin convenience)

```ts
import { hashPassword } from "@/lib/auth/password";
const pw = process.argv[2];
if (!pw) { console.error("usage: tsx scripts/hash-password.ts <password>"); process.exit(1); }
console.log(hashPassword(pw));
```
Add script: `"hash:password": "tsx scripts/hash-password.ts"`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "Add password hashing and session config"
```

### Task 7.2: Login/logout routes + page + middleware guard

**Files:** Create `src/app/(auth)/login/page.tsx`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/middleware.ts`

- [ ] **Step 1: Implement `src/app/api/auth/login/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { config } from "@/lib/config";

export async function POST(req: Request) {
  const { user, password } = await req.json();
  const cfg = config();
  const ok = user === cfg.adminUser && verifyPassword(password ?? "", cfg.adminPasswordHash);
  if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.user = user; session.loggedIn = true; await session.save();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Implement `src/app/api/auth/logout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/auth/session";

export async function POST() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.destroy();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Implement `src/app/(auth)/login/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, password }),
    });
    if (res.ok) router.push("/");
    else setError("Invalid credentials");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border p-8 shadow-sm">
        <h1 className="text-xl font-semibold">DMARC Dashboard</h1>
        <input className="w-full rounded-md border px-3 py-2" placeholder="Username"
          value={user} onChange={(e) => setUser(e.target.value)} />
        <input className="w-full rounded-md border px-3 py-2" type="password" placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button className="w-full rounded-md bg-primary px-3 py-2 text-primary-foreground" type="submit">Sign in</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Implement `src/middleware.ts`** (guard dashboard, allow login + auth API + assets)

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth/session";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions as any);
  const isLogin = req.nextUrl.pathname.startsWith("/login");
  if (!session.loggedIn && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (session.loggedIn && isLogin) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return res;
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 5: Verify**

Run: `npm run dev`, visit `/` → redirected to `/login`; sign in with the admin creds (hash generated via `npm run hash:password`); land on dashboard.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add admin login/logout and route guard"
```

---

## Milestone 8: Dashboard query layer

### Task 8.1: Aggregate queries

**Files:** Create `src/lib/db/queries.ts`; Test `tests/queries.test.ts`

- [ ] **Step 1: Write the failing test `tests/queries.test.ts`** (seed via ingest, assert KPIs)

```ts
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { migrate } from "@/lib/db/migrate";
import { closeDb } from "@/lib/db/connection";
import { ingestAttachment } from "@/lib/ingest/ingest";
import { overviewKpis, volumeByDay, topSources, dispositionBreakdown } from "@/lib/db/queries";

const TMP = "data/test-queries.db";
afterEach(() => { closeDb(); for (const s of ["","-wal","-shm"]) fs.rmSync(TMP+s,{force:true}); });

function seed() {
  migrate(TMP);
  for (const f of ["google.xml","microsoft.xml","rfc9990.xml"])
    ingestAttachment(fs.readFileSync(`tests/fixtures/${f}`), f, "m-"+f, TMP);
}

describe("queries", () => {
  it("overviewKpis sums counts and computes pass rates", () => {
    seed();
    const k = overviewKpis(TMP, {});
    // google count2 (dkim pass), microsoft count7 (both fail), rfc9990 count3 (both pass)
    expect(k.totalMessages).toBe(12);
    // DMARC pass = dkim_aligned pass OR spf_aligned pass: google(2)+rfc9990(3)=5
    expect(k.dmarcPass).toBe(5);
    expect(k.distinctSources).toBe(3);
  });

  it("dispositionBreakdown groups by disposition", () => {
    seed();
    const d = dispositionBreakdown(TMP, {});
    const map = Object.fromEntries(d.map((r) => [r.disposition, r.messages]));
    expect(map["none"]).toBe(2);
    expect(map["quarantine"]).toBe(7);
    expect(map["pass"]).toBe(3);
  });

  it("topSources returns sources ordered by volume", () => {
    seed();
    const s = topSources(TMP, {}, 10);
    expect(s[0].messages).toBeGreaterThanOrEqual(s[s.length - 1].messages);
    expect(s.some((r) => r.sourceIp === "40.92.0.1")).toBe(true);
  });

  it("volumeByDay returns rows keyed by day", () => {
    seed();
    const v = volumeByDay(TMP, {});
    expect(v.length).toBeGreaterThan(0);
    expect(v[0]).toHaveProperty("day");
    expect(v[0]).toHaveProperty("pass");
    expect(v[0]).toHaveProperty("fail");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- tests/queries.test.ts`  Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/db/queries.ts`**

```ts
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
      SUM(CASE WHEN dkim_aligned='pass' AND spf_aligned='pass' THEN count ELSE 0 END) AS both,
      SUM(CASE WHEN dkim_aligned='pass' AND (spf_aligned IS NULL OR spf_aligned<>'pass') THEN count ELSE 0 END) AS dkimOnly,
      SUM(CASE WHEN spf_aligned='pass' AND (dkim_aligned IS NULL OR dkim_aligned<>'pass') THEN count ELSE 0 END) AS spfOnly,
      SUM(CASE WHEN (dkim_aligned IS NULL OR dkim_aligned<>'pass') AND (spf_aligned IS NULL OR spf_aligned<>'pass') THEN count ELSE 0 END) AS neither
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

export function droppedFieldsSummary(dbPath?: string) {
  const rows = getDb(dbPath).prepare(`SELECT dropped_fields FROM ingest_log WHERE dropped_fields IS NOT NULL`).all() as any[];
  const counts = new Map<string, number>();
  for (const r of rows) for (const f of JSON.parse(r.dropped_fields) as string[]) counts.set(f, (counts.get(f) ?? 0) + 1);
  return Array.from(counts, ([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count);
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- tests/queries.test.ts`  Expected: PASS (4 tests). If `dmarcPass`/disposition counts differ, re-read the fixtures and correct the expected values in the test to match the seeded data, not the query.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add dashboard aggregate query layer"
```

---

## Milestone 9: Dashboard UI

> Install shadcn primitives first, then build pages. Server Components call the query layer directly (no API layer needed for reads). Charts are Client Components fed by server-fetched props.

### Task 9.1: shadcn init + chart primitives

- [ ] **Step 1: Init shadcn and add components**

```bash
npx shadcn@latest init -d
npx shadcn@latest add card table badge button select tabs
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "Add shadcn ui primitives"
```

### Task 9.2: Dashboard shell + nav + filters

**Files:** Create `src/app/(dashboard)/layout.tsx`, `src/components/nav.tsx`, `src/components/filter-bar.tsx`

- [ ] **Step 1: Implement `src/app/(dashboard)/layout.tsx`**

```tsx
import Link from "next/link";
import { Nav } from "@/components/nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/" className="font-semibold">DMARC Dashboard</Link>
          <Nav />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Implement `src/components/nav.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/sources", label: "Sources" },
  { href: "/authentication", label: "Authentication" },
  { href: "/policy", label: "Policy" },
  { href: "/reports", label: "Reports" },
  { href: "/ingest-log", label: "Ingest Log" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {links.map((l) => (
        <Link key={l.href} href={l.href}
          className={`rounded-md px-3 py-1.5 ${path === l.href ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          {l.label}
        </Link>
      ))}
      <form action="/api/auth/logout" method="post" onSubmit={(e) => {
        e.preventDefault(); fetch("/api/auth/logout", { method: "POST" }).then(() => location.assign("/login"));
      }}>
        <button className="rounded-md px-3 py-1.5 hover:bg-muted" type="submit">Sign out</button>
      </form>
    </nav>
  );
}
```

- [ ] **Step 3: Implement `src/components/filter-bar.tsx`** (date range + domain via querystring)

```tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";

export function FilterBar({ domains }: { domains: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push("?" + next.toString());
  }
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <label className="text-sm">Domain
        <select className="ml-2 rounded-md border px-2 py-1" defaultValue={params.get("domain") ?? ""}
          onChange={(e) => setParam("domain", e.target.value)}>
          <option value="">All</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
      <label className="text-sm">From
        <input type="date" className="ml-2 rounded-md border px-2 py-1" defaultValue={params.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)} />
      </label>
      <label className="text-sm">To
        <input type="date" className="ml-2 rounded-md border px-2 py-1" defaultValue={params.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)} />
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/lib/filters.ts`** (parse searchParams → `Filters`)

```ts
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
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add dashboard shell, nav, and filter bar"
```

### Task 9.3: Overview page + KPI cards + volume chart

**Files:** Create `src/app/(dashboard)/page.tsx`, `src/components/kpi-card.tsx`, `src/components/volume-chart.tsx`

- [ ] **Step 1: Implement `src/components/kpi-card.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KpiCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Implement `src/components/volume-chart.tsx`** (Client Component, Recharts)

```tsx
"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

export function VolumeChart({ data }: { data: { day: string; pass: number; fail: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="day" fontSize={12} /><YAxis fontSize={12} />
          <Tooltip /><Legend />
          <Bar dataKey="pass" stackId="a" fill="#16a34a" name="DMARC pass" />
          <Bar dataKey="fail" stackId="a" fill="#dc2626" name="DMARC fail" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Implement `src/app/(dashboard)/page.tsx`** (Server Component)

```tsx
import { config } from "@/lib/config";
import { overviewKpis, volumeByDay, listDomains } from "@/lib/db/queries";
import { parseFilters } from "@/lib/filters";
import { KpiCard } from "@/components/kpi-card";
import { VolumeChart } from "@/components/volume-chart";
import { FilterBar } from "@/components/filter-bar";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const dbPath = config().dbPath;
  const f = parseFilters(sp);
  const k = overviewKpis(dbPath, f);
  const volume = volumeByDay(dbPath, f);
  const domains = listDomains(dbPath);
  const pct = (n: number) => k.totalMessages ? `${Math.round((n / k.totalMessages) * 100)}%` : "0%";

  return (
    <div>
      <FilterBar domains={domains} />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard title="Total messages" value={k.totalMessages.toLocaleString()} />
        <KpiCard title="DMARC pass" value={pct(k.dmarcPass)} sub={`${k.dmarcPass.toLocaleString()} msgs`} />
        <KpiCard title="SPF pass" value={pct(k.spfPass)} />
        <KpiCard title="DKIM pass" value={pct(k.dkimPass)} />
        <KpiCard title="Quarantined" value={k.quarantined.toLocaleString()} />
        <KpiCard title="Rejected" value={k.rejected.toLocaleString()} />
        <KpiCard title="Sending sources" value={k.distinctSources.toLocaleString()} />
      </div>
      <div className="rounded-xl border bg-background p-4">
        <h2 className="mb-4 text-sm font-medium">Volume by day</h2>
        <VolumeChart data={volume} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run dev`, sign in, confirm Overview renders KPIs + chart (seed data first via `npm run poll:once` or a fixture import). 

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add overview page with KPI cards and volume chart"
```

### Task 9.4: Sources page + GeoIP map

**Files:** Create `src/app/(dashboard)/sources/page.tsx`, `src/components/source-table.tsx`, `src/components/geo-map.tsx`, `src/lib/geo/geoip.ts`; Test `tests/geoip.test.ts`

- [ ] **Step 1: Implement `src/lib/geo/geoip.ts`**

```ts
import maxmind, { type CityResponse, type Reader } from "maxmind";
import path from "node:path";
import fs from "node:fs";

let reader: Reader<CityResponse> | null = null;
let attempted = false;

async function getReader(): Promise<Reader<CityResponse> | null> {
  if (attempted) return reader;
  attempted = true;
  const p = path.join(process.cwd(), "data", "GeoLite2-City.mmdb");
  if (!fs.existsSync(p)) return null;
  reader = await maxmind.open<CityResponse>(p);
  return reader;
}

export async function locate(ip: string): Promise<{ lat: number; lon: number; country?: string } | null> {
  const r = await getReader();
  if (!r) return null;
  try {
    const res = r.get(ip);
    if (!res?.location) return null;
    return { lat: res.location.latitude, lon: res.location.longitude, country: res.country?.iso_code };
  } catch { return null; }
}
```

- [ ] **Step 2: Write `tests/geoip.test.ts`** (gracefully returns null without DB)

```ts
import { describe, it, expect } from "vitest";
import { locate } from "@/lib/geo/geoip";

describe("geoip", () => {
  it("returns null when no mmdb is present", async () => {
    expect(await locate("8.8.8.8")).toBeNull();
  });
});
```

Run: `npm test -- tests/geoip.test.ts`  Expected: PASS (assuming no mmdb in CI).

- [ ] **Step 3: Implement `src/components/source-table.tsx`**

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function SourceTable({ rows }: { rows: { sourceIp: string; messages: number; pass: number; fail: number }[] }) {
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Source IP</TableHead><TableHead className="text-right">Messages</TableHead>
        <TableHead className="text-right">Pass</TableHead><TableHead className="text-right">Fail</TableHead>
        <TableHead className="text-right">Pass rate</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.sourceIp}>
            <TableCell className="font-mono text-xs">{r.sourceIp}</TableCell>
            <TableCell className="text-right">{r.messages.toLocaleString()}</TableCell>
            <TableCell className="text-right text-green-600">{r.pass.toLocaleString()}</TableCell>
            <TableCell className="text-right text-red-600">{r.fail.toLocaleString()}</TableCell>
            <TableCell className="text-right">{r.messages ? Math.round((r.pass / r.messages) * 100) : 0}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Implement `src/components/geo-map.tsx`** (Client Component, react-simple-maps)

```tsx
"use client";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export function GeoMap({ points }: { points: { lat: number; lon: number; messages: number; failRate: number }[] }) {
  return (
    <div className="h-96 w-full">
      <ComposableMap projectionConfig={{ scale: 140 }}>
        <Geographies geography={GEO_URL}>
          {({ geographies }) => geographies.map((geo) => (
            <Geography key={geo.rsmKey} geography={geo} fill="#e5e7eb" stroke="#fff" strokeWidth={0.3} />
          ))}
        </Geographies>
        {points.map((p, i) => (
          <Marker key={i} coordinates={[p.lon, p.lat]}>
            <circle r={Math.min(3 + Math.log10(p.messages + 1) * 3, 14)}
              fill={p.failRate > 0.5 ? "#dc2626" : "#16a34a"} fillOpacity={0.6} stroke="#fff" strokeWidth={0.5} />
          </Marker>
        ))}
      </ComposableMap>
    </div>
  );
}
```

- [ ] **Step 5: Implement `src/app/(dashboard)/sources/page.tsx`** (Server Component, enriches top sources with geo)

```tsx
import { config } from "@/lib/config";
import { topSources, listDomains } from "@/lib/db/queries";
import { parseFilters } from "@/lib/filters";
import { locate } from "@/lib/geo/geoip";
import { SourceTable } from "@/components/source-table";
import { GeoMap } from "@/components/geo-map";
import { FilterBar } from "@/components/filter-bar";

export const dynamic = "force-dynamic";

export default async function SourcesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const dbPath = config().dbPath;
  const f = parseFilters(sp);
  const sources = topSources(dbPath, f, 100);
  const domains = listDomains(dbPath);

  const points: { lat: number; lon: number; messages: number; failRate: number }[] = [];
  for (const s of sources.slice(0, 100)) {
    const geo = await locate(s.sourceIp);
    if (geo) points.push({ lat: geo.lat, lon: geo.lon, messages: s.messages, failRate: s.messages ? s.fail / s.messages : 0 });
  }

  return (
    <div>
      <FilterBar domains={domains} />
      {points.length > 0 && (
        <div className="mb-6 rounded-xl border bg-background p-4">
          <h2 className="mb-2 text-sm font-medium">Source geography (red = mostly failing)</h2>
          <GeoMap points={points} />
        </div>
      )}
      <div className="rounded-xl border bg-background p-4">
        <h2 className="mb-4 text-sm font-medium">Top sending sources</h2>
        <SourceTable rows={sources} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add sources page with table and GeoIP map"
```

### Task 9.5: Authentication, Policy, Reports, Ingest-Log pages

**Files:** Create `src/app/(dashboard)/authentication/page.tsx`, `src/app/(dashboard)/policy/page.tsx`, `src/app/(dashboard)/reports/page.tsx`, `src/app/(dashboard)/reports/[id]/page.tsx`, `src/app/(dashboard)/ingest-log/page.tsx`, `src/components/breakdown-bar.tsx`

- [ ] **Step 1: Implement `src/components/breakdown-bar.tsx`** (reusable horizontal bar list)

```tsx
export function BreakdownBar({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <div className="w-40 truncate text-sm">{r.label}</div>
          <div className="h-4 flex-1 rounded bg-muted">
            <div className="h-4 rounded bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <div className="w-16 text-right text-sm tabular-nums">{r.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement `src/app/(dashboard)/authentication/page.tsx`**

```tsx
import { config } from "@/lib/config";
import { authQuadrant, listDomains } from "@/lib/db/queries";
import { parseFilters } from "@/lib/filters";
import { KpiCard } from "@/components/kpi-card";
import { FilterBar } from "@/components/filter-bar";

export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const dbPath = config().dbPath;
  const q = authQuadrant(dbPath, parseFilters(sp));
  const domains = listDomains(dbPath);
  return (
    <div>
      <FilterBar domains={domains} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard title="SPF + DKIM" value={q.both.toLocaleString()} />
        <KpiCard title="DKIM only" value={q.dkimOnly.toLocaleString()} />
        <KpiCard title="SPF only" value={q.spfOnly.toLocaleString()} />
        <KpiCard title="Neither" value={q.neither.toLocaleString()} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement `src/app/(dashboard)/policy/page.tsx`**

```tsx
import { config } from "@/lib/config";
import { dispositionBreakdown, listDomains } from "@/lib/db/queries";
import { parseFilters } from "@/lib/filters";
import { BreakdownBar } from "@/components/breakdown-bar";
import { FilterBar } from "@/components/filter-bar";

export const dynamic = "force-dynamic";

export default async function PolicyPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const dbPath = config().dbPath;
  const d = dispositionBreakdown(dbPath, parseFilters(sp));
  const domains = listDomains(dbPath);
  return (
    <div>
      <FilterBar domains={domains} />
      <div className="rounded-xl border bg-background p-4">
        <h2 className="mb-4 text-sm font-medium">Disposition breakdown</h2>
        <BreakdownBar rows={d.map((r) => ({ label: r.disposition, value: r.messages }))} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement `src/app/(dashboard)/reports/page.tsx`**

```tsx
import Link from "next/link";
import { config } from "@/lib/config";
import { recentReports } from "@/lib/db/queries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const rows = recentReports(config().dbPath, 200);
  return (
    <div className="rounded-xl border bg-background p-4">
      <h2 className="mb-4 text-sm font-medium">Recent reports</h2>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Reporter</TableHead><TableHead>Domain</TableHead>
          <TableHead>Range</TableHead><TableHead className="text-right">Messages</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell><Link className="text-primary underline" href={`/reports/${r.id}`}>{r.orgName}</Link></TableCell>
              <TableCell>{r.domain ?? "-"}</TableCell>
              <TableCell className="text-xs">{new Date(r.dateBegin * 1000).toISOString().slice(0, 10)} → {new Date(r.dateEnd * 1000).toISOString().slice(0, 10)}</TableCell>
              <TableCell className="text-right">{Number(r.messages).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 5: Implement `src/app/(dashboard)/reports/[id]/page.tsx`**

```tsx
import { config } from "@/lib/config";
import { reportDetail } from "@/lib/db/queries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { report, policy, records } = reportDetail(config().dbPath, Number(id));
  if (!report) return <div>Report not found.</div>;
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-background p-4">
        <h2 className="mb-2 text-sm font-medium">{report.org_name} — {policy?.domain}</h2>
        <p className="text-xs text-muted-foreground">Report {report.report_id} · policy p={policy?.p ?? "-"} sp={policy?.sp ?? "-"} adkim={policy?.adkim ?? "-"} aspf={policy?.aspf ?? "-"}</p>
      </div>
      <div className="rounded-xl border bg-background p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Source IP</TableHead><TableHead className="text-right">Count</TableHead>
            <TableHead>Disposition</TableHead><TableHead>DKIM</TableHead><TableHead>SPF</TableHead><TableHead>Header From</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {records.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.source_ip}</TableCell>
                <TableCell className="text-right">{r.count}</TableCell>
                <TableCell>{r.disposition}</TableCell>
                <TableCell className={r.dkim_aligned === "pass" ? "text-green-600" : "text-red-600"}>{r.dkim_aligned}</TableCell>
                <TableCell className={r.spf_aligned === "pass" ? "text-green-600" : "text-red-600"}>{r.spf_aligned}</TableCell>
                <TableCell>{r.header_from}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Implement `src/app/(dashboard)/ingest-log/page.tsx`**

```tsx
import { config } from "@/lib/config";
import { ingestLog, droppedFieldsSummary } from "@/lib/db/queries";
import { BreakdownBar } from "@/components/breakdown-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function IngestLogPage() {
  const dbPath = config().dbPath;
  const log = ingestLog(dbPath, 200);
  const dropped = droppedFieldsSummary(dbPath);
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-background p-4">
        <h2 className="mb-4 text-sm font-medium">Dropped / unknown fields (review for schema gaps)</h2>
        {dropped.length ? <BreakdownBar rows={dropped.map((d) => ({ label: d.field, value: d.count }))} />
          : <p className="text-sm text-muted-foreground">No unknown fields seen. Schema covers all incoming data.</p>}
      </div>
      <div className="rounded-xl border bg-background p-4">
        <h2 className="mb-4 text-sm font-medium">Ingest history</h2>
        <Table>
          <TableHeader><TableRow>
            <TableHead>File</TableHead><TableHead>Reporter</TableHead><TableHead>Status</TableHead>
            <TableHead className="text-right">Records</TableHead><TableHead>When</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {log.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.filename}</TableCell>
                <TableCell>{r.reporter ?? "-"}</TableCell>
                <TableCell className={r.status === "failed" ? "text-red-600" : r.status === "duplicate" ? "text-amber-600" : "text-green-600"}>{r.status}</TableCell>
                <TableCell className="text-right">{r.recordsIngested}</TableCell>
                <TableCell className="text-xs">{new Date(r.processedAt * 1000).toISOString().replace("T", " ").slice(0, 16)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify all pages render**

Run: `npm run dev`, click through every nav link. Expected: no runtime errors; pages show seeded data.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "Add authentication, policy, reports, and ingest-log pages"
```

---

## Milestone 9.6: Email digests (MailerSend)

> Closes the main gap vs. Postmark Premium. Depends on the query layer (M8) and scheduler (M6). The MailerSend API token lives at `C:/Users/DavidSoden/registry/email_access_token.txt`; copy it into `.env` as `MAILERSEND_API_TOKEN` (never commit it).

### Task D.1: Digest summary query

**Files:** Modify `src/lib/db/queries.ts`; Test add to `tests/queries.test.ts`

- [ ] **Step 1: Write the failing test (append to `tests/queries.test.ts`)**

```ts
import { digestSummary } from "@/lib/db/queries";

describe("digestSummary", () => {
  it("returns kpis, top sources, and new sources for a window", () => {
    seed();
    const s = digestSummary(TMP, { from: 0, to: 9_999_999_999 }, 0);
    expect(s.kpis.totalMessages).toBe(12);
    expect(s.topSources.length).toBeGreaterThan(0);
    // every source is "new" when prevWindowStart is after all data (no prior history)
    expect(Array.isArray(s.newSources)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- tests/queries.test.ts`  Expected: FAIL (digestSummary not defined).

- [ ] **Step 3: Implement `digestSummary` in `src/lib/db/queries.ts`**

```ts
export function digestSummary(dbPath: string | undefined, f: Filters, prevWindowStart: number) {
  const kpis = overviewKpis(dbPath, f);
  const topSources = topSources_(dbPath, f, 10);
  const db = getDb(dbPath);
  // Sources seen in this window that were never seen before prevWindowStart.
  const newSources = db.prepare(`
    SELECT DISTINCT rec.source_ip AS sourceIp
    FROM record rec JOIN report r ON r.id = rec.report_id
    WHERE r.date_begin >= ?
      AND rec.source_ip NOT IN (
        SELECT DISTINCT rec2.source_ip FROM record rec2 JOIN report r2 ON r2.id = rec2.report_id
        WHERE r2.date_begin < ?
      )`).all(f.from ?? 0, prevWindowStart).map((r: any) => r.sourceIp) as string[];
  return { kpis, topSources, newSources };
}
```

(Note: `topSources_` is an internal alias — rename the existing exported `topSources` call here to the exported name `topSources`. Concretely: call the already-defined `topSources(dbPath, f, 10)`; do not create a new function. The line should read `const topSources = topSources(dbPath, f, 10);` renamed to a local `const top = topSources(dbPath, f, 10);` to avoid shadowing, and return `{ kpis, topSources: top, newSources }`.)

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- tests/queries.test.ts`  Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add digest summary query"
```

### Task D.2: MailerSend client

**Files:** Create `src/lib/email/mailersend.ts`; Test `tests/mailersend.test.ts`

- [ ] **Step 1: Write the failing test (mock fetch, assert request shape)**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendEmail } from "@/lib/email/mailersend";

describe("sendEmail", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  it("POSTs to MailerSend with auth header and recipients", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    await sendEmail({
      token: "tok", from: "dmarc@beaconspec.com", fromName: "DMARC",
      to: ["a@x.com", "b@x.com"], subject: "Weekly", html: "<p>hi</p>",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.mailersend.com/v1/email");
    expect((init.headers as any).Authorization).toBe("Bearer tok");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual([{ email: "a@x.com" }, { email: "b@x.com" }]);
    expect(body.subject).toBe("Weekly");
  });

  it("throws on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => "bad" }));
    await expect(sendEmail({ token: "t", from: "f@x.com", to: ["a@x.com"], subject: "s", html: "h" }))
      .rejects.toThrow(/422/);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- tests/mailersend.test.ts`  Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/email/mailersend.ts`**

```ts
export interface SendEmailOpts {
  token: string; from: string; fromName?: string;
  to: string[]; subject: string; html: string; text?: string;
}

export async function sendEmail(o: SendEmailOpts): Promise<void> {
  const res = await fetch("https://api.mailersend.com/v1/email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${o.token}`,
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({
      from: { email: o.from, name: o.fromName ?? "DMARC Dashboard" },
      to: o.to.map((email) => ({ email })),
      subject: o.subject,
      html: o.html,
      text: o.text ?? o.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    }),
  });
  if (!res.ok) throw new Error(`MailerSend send failed: ${res.status} ${await res.text()}`);
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- tests/mailersend.test.ts`  Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add MailerSend email client"
```

### Task D.3: Digest builder (HTML) + runner

**Files:** Create `src/lib/email/digest.ts`; Test `tests/digest.test.ts`

- [ ] **Step 1: Write the failing test `tests/digest.test.ts`**

```ts
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { migrate } from "@/lib/db/migrate";
import { closeDb } from "@/lib/db/connection";
import { ingestAttachment } from "@/lib/ingest/ingest";
import { buildDigestHtml } from "@/lib/email/digest";

const TMP = "data/test-digest.db";
afterEach(() => { closeDb(); for (const s of ["","-wal","-shm"]) fs.rmSync(TMP+s,{force:true}); });

describe("buildDigestHtml", () => {
  it("renders compliance and top sources into HTML", () => {
    migrate(TMP);
    for (const f of ["google.xml","microsoft.xml","rfc9990.xml"])
      ingestAttachment(fs.readFileSync(`tests/fixtures/${f}`), f, "m-"+f, TMP);
    const { subject, html } = buildDigestHtml(TMP, "weekly", { from: 0, to: 9_999_999_999 }, 0);
    expect(subject).toMatch(/Weekly DMARC/i);
    expect(html).toContain("12"); // total messages
    expect(html).toContain("40.92.0.1"); // a top source
    expect(html).toMatch(/%/); // a compliance percentage
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test -- tests/digest.test.ts`  Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/email/digest.ts`**

```ts
import { digestSummary, type Filters } from "@/lib/db/queries";

function pct(n: number, total: number) { return total ? Math.round((n / total) * 100) : 0; }

export function buildDigestHtml(
  dbPath: string | undefined, period: "weekly" | "monthly", f: Filters, prevWindowStart: number,
): { subject: string; html: string } {
  const s = digestSummary(dbPath, f, prevWindowStart);
  const k = s.kpis;
  const label = period === "weekly" ? "Weekly" : "Monthly";
  const subject = `${label} DMARC digest — ${pct(k.dmarcPass, k.totalMessages)}% compliant, ${k.totalMessages.toLocaleString()} messages`;

  const sourceRows = s.topSources.map((src) => `
    <tr>
      <td style="padding:6px 10px;font-family:monospace;font-size:12px">${src.sourceIp}</td>
      <td style="padding:6px 10px;text-align:right">${src.messages.toLocaleString()}</td>
      <td style="padding:6px 10px;text-align:right;color:#16a34a">${src.pass.toLocaleString()}</td>
      <td style="padding:6px 10px;text-align:right;color:#dc2626">${src.fail.toLocaleString()}</td>
    </tr>`).join("");

  const newSources = s.newSources.length
    ? `<p style="margin:8px 0;color:#b45309"><strong>${s.newSources.length} new sending source(s)</strong>: ${s.newSources.slice(0, 15).join(", ")}</p>`
    : `<p style="margin:8px 0;color:#64748b">No new sending sources this period.</p>`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
    <h1 style="font-size:20px">${label} DMARC digest</h1>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr>
        <td style="padding:12px;border:1px solid #e2e8f0"><div style="font-size:12px;color:#64748b">Messages</div><div style="font-size:22px;font-weight:700">${k.totalMessages.toLocaleString()}</div></td>
        <td style="padding:12px;border:1px solid #e2e8f0"><div style="font-size:12px;color:#64748b">DMARC pass</div><div style="font-size:22px;font-weight:700">${pct(k.dmarcPass, k.totalMessages)}%</div></td>
        <td style="padding:12px;border:1px solid #e2e8f0"><div style="font-size:12px;color:#64748b">SPF / DKIM</div><div style="font-size:22px;font-weight:700">${pct(k.spfPass, k.totalMessages)}% / ${pct(k.dkimPass, k.totalMessages)}%</div></td>
      </tr>
      <tr>
        <td style="padding:12px;border:1px solid #e2e8f0"><div style="font-size:12px;color:#64748b">Quarantined</div><div style="font-size:22px;font-weight:700">${k.quarantined.toLocaleString()}</div></td>
        <td style="padding:12px;border:1px solid #e2e8f0"><div style="font-size:12px;color:#64748b">Rejected</div><div style="font-size:22px;font-weight:700">${k.rejected.toLocaleString()}</div></td>
        <td style="padding:12px;border:1px solid #e2e8f0"><div style="font-size:12px;color:#64748b">Sources</div><div style="font-size:22px;font-weight:700">${k.distinctSources.toLocaleString()}</div></td>
      </tr>
    </table>
    ${newSources}
    <h2 style="font-size:15px;margin-top:24px">Top sending sources</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0">
      <tr style="background:#f8fafc;text-align:left">
        <th style="padding:6px 10px">Source IP</th><th style="padding:6px 10px;text-align:right">Messages</th>
        <th style="padding:6px 10px;text-align:right">Pass</th><th style="padding:6px 10px;text-align:right">Fail</th>
      </tr>
      ${sourceRows}
    </table>
    <p style="margin-top:24px;font-size:12px;color:#94a3b8">Generated by your self-hosted DMARC Dashboard.</p>
  </div>`;

  return { subject, html };
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test -- tests/digest.test.ts`  Expected: PASS.

- [ ] **Step 5: Implement `src/lib/email/send-digest.ts`** (window math + send)

```ts
import { config } from "@/lib/config";
import { buildDigestHtml } from "./digest";
import { sendEmail } from "./mailersend";

const DAY = 86400;

export async function sendDigest(period: "weekly" | "monthly", now: number): Promise<void> {
  const cfg = config();
  if (!cfg.mailersendToken) { console.warn("[digest] MAILERSEND_API_TOKEN not set; skipping"); return; }
  const span = period === "weekly" ? 7 * DAY : 30 * DAY;
  const from = now - span;
  const prevWindowStart = now - 2 * span;
  const { subject, html } = buildDigestHtml(cfg.dbPath, period, { from, to: now }, prevWindowStart);
  await sendEmail({
    token: cfg.mailersendToken, from: cfg.mailersendFrom, fromName: "DMARC Dashboard",
    to: cfg.digestRecipients, subject, html,
  });
  console.log(`[digest] sent ${period} digest to ${cfg.digestRecipients.join(", ")}`);
}
```

- [ ] **Step 6: Implement `scripts/send-digest.ts`** (manual run)

```ts
import "dotenv/config";
import { migrate } from "@/lib/db/migrate";
import { sendDigest } from "@/lib/email/send-digest";

const period = (process.argv[2] as "weekly" | "monthly") ?? "weekly";
(async () => {
  migrate();
  await sendDigest(period, Math.floor(Date.now() / 1000));
})().catch((e) => { console.error(e); process.exit(1); });
```
Add script: `"digest": "tsx scripts/send-digest.ts"`. Usage: `npm run digest -- weekly`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "Add digest HTML builder and send runner"
```

### Task D.4: Wire digests into the scheduler

**Files:** Modify `src/lib/scheduler.ts`

- [ ] **Step 1: Add digest cron jobs to `startScheduler()` in `src/lib/scheduler.ts`**

Add this import at the top:
```ts
import { sendDigest } from "@/lib/email/send-digest";
```
Then inside `startScheduler()`, after the existing `cron.schedule(cfg.pollCron, ...)` line, add:
```ts
  if (cfg.mailersendToken) {
    if (cron.validate(cfg.digestWeeklyCron))
      cron.schedule(cfg.digestWeeklyCron, () => { void sendDigest("weekly", Math.floor(Date.now() / 1000)); });
    if (cron.validate(cfg.digestMonthlyCron))
      cron.schedule(cfg.digestMonthlyCron, () => { void sendDigest("monthly", Math.floor(Date.now() / 1000)); });
    console.log(`[scheduler] digests scheduled (weekly "${cfg.digestWeeklyCron}", monthly "${cfg.digestMonthlyCron}")`);
  } else {
    console.log("[scheduler] MAILERSEND_API_TOKEN not set; digests disabled");
  }
```

- [ ] **Step 2: Verify boot**

Run: `npm run dev`  Expected: logs show digest schedule lines when the token is set. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Schedule weekly and monthly digests"
```

## Milestone 10: Entra setup doc + GeoLite2 fetch

### Task 10.1: Entra app-registration walkthrough

**Files:** Create `docs/SETUP-ENTRA.md`

- [ ] **Step 1: Write `docs/SETUP-ENTRA.md`** with these exact steps:

```markdown
# Office 365 / Entra setup for DMARC Dashboard

The app reads one mailbox via Microsoft Graph using app-only (client credentials) auth.

## 1. Register the app
1. Entra admin center → App registrations → New registration.
2. Name: "DMARC Dashboard". Supported account types: single tenant. Register.
3. Copy **Application (client) ID** and **Directory (tenant) ID** → `.env` CLIENT_ID / TENANT_ID.

## 2. Add a client secret
1. Certificates & secrets → New client secret → copy the **Value** → `.env` CLIENT_SECRET.

## 3. Grant application permissions
1. API permissions → Add a permission → Microsoft Graph → **Application permissions**.
2. Add **Mail.ReadWrite** (read + delete/move). Add **User.Read.All** if you later resolve display names (optional).
3. Click **Grant admin consent**.

## 4. Lock access to ONLY the DMARC mailbox (important)
Application permissions grant access to ALL mailboxes by default. Restrict to one:

```powershell
# Requires Exchange Online PowerShell (Connect-ExchangeOnline)
New-DistributionGroup -Name "DMARC-App-Mailboxes" -Type Security -PrimarySmtpAddress dmarc-app-scope@yourdomain.com
Add-DistributionGroupMember -Identity "DMARC-App-Mailboxes" -Member dmarc@yourdomain.com

New-ApplicationAccessPolicy -AppId <CLIENT_ID> `
  -PolicyScopeGroupId dmarc-app-scope@yourdomain.com `
  -AccessRight RestrictAccess `
  -Description "Restrict DMARC Dashboard to the DMARC mailbox only"

# Verify:
Test-ApplicationAccessPolicy -Identity dmarc@yourdomain.com -AppId <CLIENT_ID>   # AccessCheckResult: Granted
Test-ApplicationAccessPolicy -Identity someoneelse@yourdomain.com -AppId <CLIENT_ID>  # Denied
```

## 5. Fill `.env`
Copy `.env.example` to `.env`, fill TENANT_ID/CLIENT_ID/CLIENT_SECRET/MAILBOX_UPN.
Generate the admin password hash: `npm run hash:password 'your-password'` → ADMIN_PASSWORD_HASH.
Generate a session secret: any 32+ char random string → SESSION_SECRET.
For digests, copy the MailerSend token from `C:/Users/DavidSoden/registry/email_access_token.txt`
into MAILERSEND_API_TOKEN, set MAILERSEND_FROM to a verified MailerSend sender domain, and
adjust DIGEST_RECIPIENTS if needed (defaults: david.soden@ and duane.walker@beaconspec.com).

## 6. Smoke test
`npm run poll:once` → should print a poll result and create rows in `data/dmarc.db`.
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "Add Entra app-registration setup doc"
```

### Task 10.2: GeoLite2 download script

**Files:** Create `scripts/fetch-geolite.ts`

- [ ] **Step 1: Implement `scripts/fetch-geolite.ts`**

```ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import * as tar from "tar-stream";

const key = process.env.MAXMIND_LICENSE_KEY;
if (!key) { console.error("Set MAXMIND_LICENSE_KEY in .env first (free GeoLite2 account)."); process.exit(1); }

const url = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${key}&suffix=tar.gz`;
const outPath = path.join(process.cwd(), "data", "GeoLite2-City.mmdb");

(async () => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MaxMind download failed: ${res.status}`);
  const extract = tar.extract();
  extract.on("entry", (header, stream, next) => {
    if (header.name.endsWith(".mmdb")) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      stream.pipe(fs.createWriteStream(outPath)).on("finish", next);
    } else { stream.on("end", next); stream.resume(); }
  });
  await pipeline(zlib.createGunzip(), extract).catch(() => {});
  // feed body
  const reader = res.body!.getReader();
  // Simpler: buffer then gunzip+untar
})().catch((e) => { console.error(e); process.exit(1); });
```

(Note: prefer the simpler buffered implementation below — replace the streaming body handling with: read the whole response into a Buffer, `zlib.gunzipSync`, then feed to `tar-stream`'s extract via a `Readable.from(buffer)`. Install deps: `npm i tar-stream && npm i -D @types/tar-stream`.)

Concrete working version:
```ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { Readable } from "node:stream";
import extract from "tar-stream/extract";

const key = process.env.MAXMIND_LICENSE_KEY;
if (!key) { console.error("Set MAXMIND_LICENSE_KEY first."); process.exit(1); }
const url = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${key}&suffix=tar.gz`;
const outPath = path.join(process.cwd(), "data", "GeoLite2-City.mmdb");

(async () => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MaxMind download failed: ${res.status}`);
  const gz = Buffer.from(await res.arrayBuffer());
  const tarBuf = zlib.gunzipSync(gz);
  const ex = extract();
  ex.on("entry", (header, stream, next) => {
    if (header.name.endsWith(".mmdb")) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      stream.pipe(fs.createWriteStream(outPath)).on("finish", next);
    } else { stream.on("end", next); stream.resume(); }
  });
  ex.on("finish", () => console.log("GeoLite2 saved to", outPath));
  Readable.from(tarBuf).pipe(ex);
})().catch((e) => { console.error(e); process.exit(1); });
```
Add script: `"fetch:geo": "tsx scripts/fetch-geolite.ts"`.

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "Add GeoLite2 download script"
```

---

## Milestone 11: Docker packaging

### Task 11.1: Dockerfile + compose + standalone output

**Files:** Create `Dockerfile`, `.dockerignore`, `docker-compose.yml`; Modify `next.config.ts`

- [ ] **Step 1: Set standalone output in `next.config.ts`**

```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
};
export default nextConfig;
```

- [ ] **Step 2: Create `.dockerignore`**

```
node_modules
.next
data
.env
.git
```

- [ ] **Step 3: Create `Dockerfile`** (multi-stage; rebuild native better-sqlite3)

```dockerfile
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/lib/db/schema.sql ./src/lib/db/schema.sql
COPY --from=deps /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 4: Create `docker-compose.yml`**

```yaml
services:
  dmarc-dash:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

- [ ] **Step 5: Build and run**

Run:
```bash
docker compose build
docker compose up -d
```
Expected: container starts, logs show `[scheduler] started`; visit `http://localhost:3000` → login.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add Docker packaging and compose"
```

### Task 11.2: README

**Files:** Create `README.md`

- [ ] **Step 1: Write `README.md`** covering: what it does, a short feature comparison vs. Postmark DMARC Digests Premium (we match all-sources + dashboard, exceed on retention, add geo map + digests), the Entra setup pointer (`docs/SETUP-ENTRA.md`), env vars, `npm run hash:password`, `npm run fetch:geo`, `npm run digest -- weekly|monthly`, `docker compose up`, the 15-min poll, weekly/monthly digests, and the safe-delete behavior + `DMARC-Errors` folder.

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "Add README"
```

---

## Final verification

- [ ] **Run full test suite**

Run: `npm test`  Expected: all suites PASS.

- [ ] **Typecheck + build**

Run: `npx tsc --noEmit && npm run build`  Expected: no errors.

- [ ] **End-to-end (manual, requires real mailbox + Entra)**

1. `npm run fetch:geo` (optional map data).
2. `npm run poll:once` → reports ingested, emails deleted (or moved to `DMARC-Errors` on parse failure).
3. `npm run digest -- weekly` → confirm both recipients receive the digest email.
4. `docker compose up -d` → dashboard at `http://localhost:3000`, all pages populated; scheduler logs show poll + digest crons.

---

## Self-review notes (addressed)

- **Spec coverage:** Graph ingest (M5), decompress gzip/zip/plain (M2), dual-namespace parse (M3), dedup (Task 1.2/4.1), safe-delete vs move-to-Errors (Task 5.3), normalized schema incl. `report_extension` + `ingest_log` (M1), dropped-field capture (Task 3.3 + 4.1), all 6 dashboard views (M9), GeoIP map (Task 9.4/10.2), simple login (M7), 15-min cron (M6), email digests weekly+monthly via MailerSend (M9.6), Docker on local Docker (M11), Entra setup doc (M10). RUF/TLS-RPT, recommendations engine, multi-user, instant alerts explicitly out of scope.
- **Type consistency:** `Filters`, `DmarcReport`/`DmarcRecord`, `IngestResult`, query return shapes are defined once and reused by pages.
- **Known follow-ups during execution:** reverse-DNS/org enrichment for sources is left as a forward extension on the geo layer (map + country code ship now); org-name column can be added to `topSources` later without schema change. If `tar-stream/extract` import path differs by version, use `import { extract } from "tar-stream"`.
```
