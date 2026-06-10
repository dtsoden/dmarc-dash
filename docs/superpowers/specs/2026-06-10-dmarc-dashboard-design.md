# DMARC Dashboard — Design Spec

Date: 2026-06-10
Status: Approved (design); pending implementation plan

## 1. Purpose

A self-hosted dashboard that monitors an Office 365 mailbox for DMARC aggregate
reports, ingests them into a SQLite database, and presents a modern dashboard for
administrators. Runs unattended in Docker, polling every 15 minutes by default.

## 2. Key constraints / decisions

- **Mailbox access: Microsoft Graph, app-only (client credentials).** Office 365 has
  retired Basic Auth for IMAP/POP/SMTP (app passwords stop working April 30, 2026), so
  OAuth2 is mandatory regardless of protocol. Graph is chosen over IMAP-over-OAuth2 for
  cleaner attachment handling and reliable delete. Access is locked to the single target
  mailbox via an Exchange Application Access Policy.
- **Stack: Next.js 15 (App Router) + TypeScript + shadcn/ui + Tailwind + Recharts**,
  `better-sqlite3` for storage. One Docker container. Ingest worker runs in-process via
  `node-cron`.
- **Dashboard auth: simple single-admin login** (username + hashed password, session
  cookie).
- **GeoIP map included**, using MaxMind GeoLite2 (free license key, optional config).
- **Email digests (weekly + monthly)** via MailerSend, to a configured recipient list.
  This closes the main gap vs. Postmark DMARC Digests Premium. Recommendations engine,
  multi-user, and instant alerts are intentionally out of scope.
- **Deployment: local Docker now** (docker-compose + `.env`), portable to EasyPanel later.

## 3. Architecture

Single Next.js app, one container, two cooperating halves sharing the codebase and DB:

1. **Ingest worker** — `node-cron` schedule (default `*/15 * * * *`). Authenticates
   app-only to Graph, pulls reports from the Inbox, parses, stores, deletes the email.
2. **Dashboard** — SSR pages (shadcn/ui + Tailwind + Recharts) behind admin login.

SQLite DB file and the GeoLite2 DB live on a mounted volume so data survives container
restarts.

## 4. Ingestion pipeline

1. **Auth**: MSAL client-credentials flow → app-only token. Requires a one-time Entra app
   registration with `Mail.ReadWrite`, scoped to just the target mailbox via an Exchange
   Application Access Policy. A step-by-step setup doc will be produced.
2. **Fetch**: Graph lists Inbox messages and their attachments.
3. **Decompress**: sniff magic bytes (gzip `1f 8b`, zip `50 4b`); handle `.xml.gz`,
   `.zip` (xml inside), and plain `.xml`. Charset-detect before parsing (non-UTF-8 seen
   from some reporters).
4. **Parse**: lenient XML parse (`fast-xml-parser`) mapping **both** the legacy
   `http://dmarc.org/dmarc-xml/0.1` namespace and the RFC 9990 `dmarc-2.0` namespace into
   one union schema. Must tolerate Microsoft's known-malformed output.
5. **Store**: single transaction. **Dedup** on `(org_name, report_id, date_begin,
   date_end)` so re-runs are idempotent.
6. **Delete safely**: the email is deleted **only after a successful commit**. On a
   parse/ingest failure the email is **moved to a `DMARC-Errors` folder, not deleted**,
   and the failure is logged. This intentionally overrides "always delete" to avoid
   silently losing unreadable reports.

## 5. Data model (SQLite, normalized)

Derived from RFC 7489 (legacy) + RFC 9990 (DMARCbis) — designed to the union of both.

- `report` — 1 row per XML file. Fields: `id`, `org_name`, `reporter_email`,
  `extra_contact_info`, `report_id`, `date_begin`, `date_end`, `error`, `generator`,
  `schema_namespace`, `source_filename`, `raw_xml`, `ingested_at`.
  UNIQUE(`org_name`, `report_id`, `date_begin`, `date_end`).
- `policy_published` — 1:1 with report. `report_id` FK, `domain`, `p`, `sp`, `np`,
  `adkim`, `aspf`, `pct` (nullable), `fo`, `discovery_method` (nullable), `testing`
  (nullable).
- `record` — N per report. `id`, `report_id` FK, `source_ip` (text), `source_ip_norm`,
  `count`, `disposition`, `dkim_aligned`, `spf_aligned`, `header_from`, `envelope_from`,
  `envelope_to`.
- `auth_result_dkim` — N per record. `record_id` FK, `domain`, `selector`, `result`,
  `human_result`.
- `auth_result_spf` — N per record. `record_id` FK, `domain`, `scope`, `result`,
  `human_result`.
- `policy_override_reason` — N per record. `record_id` FK, `type`, `comment`.
- `report_extension` — N. Captures unknown/namespaced elements (ARC, future fields) as
  raw blobs so new fields never break ingest. `report_id`/`record_id` FK, `namespace`,
  `element_name`, `raw_xml`.
- `ingest_log` — per processed file: `filename`, `reporter`, `status`,
  `records_ingested`, `dropped_fields` (JSON of any field/element we had no column for),
  `message_id`, `processed_at`, `error_detail`.

Notes:
- Store enums as TEXT, unconstrained (real reporters emit out-of-spec values).
- Keep BOTH the DMARC-aligned pass/fail (`policy_evaluated` → `dkim_aligned`,
  `spf_aligned`) and the raw SPF/DKIM auth results — they are different concepts.
- `count` is the additive measure for nearly every KPI (`SUM(count)` grouped by a
  dimension).

## 6. Dashboard views

- **Overview**: total messages, % DMARC pass, % SPF pass, % DKIM pass,
  quarantined/rejected counts, distinct sources; time-series stacked by result;
  date-range + domain filters.
- **Sources**: top sending IPs/orgs, per-source pass/fail, **world map** (GeoLite2)
  colored by pass/fail, reverse-DNS / org enrichment.
- **Authentication**: SPF/DKIM 4-quadrant (both/SPF-only/DKIM-only/neither), top failing
  sources by mechanism, DKIM selector/domain breakdown.
- **Policy**: disposition distribution, published policy over time, override reasons.
- **Reports / drill-down**: browse raw reports down to individual records.
- **Ingest log**: review dropped/unknown fields and ingest failures.

## 7. Testing

TDD focused on the parser/ingest pipeline:
- Fixtures for Google, Microsoft (malformed), Yahoo reports.
- Both XML namespaces (legacy + RFC 9990).
- gzip / zip / plain decompression and magic-byte sniffing.
- Idempotent re-ingest (dedup).
- Schema mapping and union-field handling.
- Unknown-field capture into `report_extension` + `ingest_log.dropped_fields`.

## 8. Email digests

Scheduled summary emails sent via MailerSend (REST API; token stored at
`C:/Users/DavidSoden/registry/email_access_token.txt`, copied into `.env`).

- **Weekly** and **monthly** digests on their own cron schedules.
- Content: overall DMARC/SPF/DKIM compliance %, total volume, quarantined/rejected
  counts, top sending sources (pass/fail), new sources first seen in the period, and
  trend vs. the previous period. HTML email built from the same query layer the
  dashboard uses.
- Recipients come from `DIGEST_RECIPIENTS` (comma-separated), default
  `david.soden@beaconspec.com, duane.walker@beaconspec.com`.
- A one-shot `npm run digest -- weekly|monthly` command is provided for manual sends and
  testing.

## 9. Configuration (`.env`)

```
TENANT_ID
CLIENT_ID
CLIENT_SECRET
MAILBOX_UPN
POLL_CRON=*/15 * * * *
MAXMIND_LICENSE_KEY
ADMIN_USER
ADMIN_PASSWORD_HASH
SESSION_SECRET
DB_PATH
DELETE_MODE        # safe (default) | hard
MAILERSEND_API_TOKEN
MAILERSEND_FROM=dmarc@beaconspec.com
DIGEST_RECIPIENTS=david.soden@beaconspec.com,duane.walker@beaconspec.com
DIGEST_WEEKLY_CRON=0 8 * * 1      # Mondays 08:00
DIGEST_MONTHLY_CRON=0 8 1 * *     # 1st of month 08:00
```

## 10. Out of scope (v1)

Schema leaves room but these are not built now:
- Forensic / failure (RUF / AFRF) reports.
- SMTP TLS Reporting (TLS-RPT, JSON, RFC 8460).
- Recommendations engine, multi-user/teams, instant (non-digest) alerts.

## 11. References

- RFC 7489 Appendix C (legacy aggregate schema).
- RFC 9990 — DMARC Aggregate Reporting (DMARCbis, current standard).
- RFC 9989 — DMARC core; RFC 9991 — Failure Reporting.
- Microsoft: deprecation of Basic Auth in Exchange Online; OAuth2 for IMAP/SMTP.
- parsedmarc (reporter quirks, lenient parsing) and dmarc-visualizer / Grafana DMARC
  dashboards (KPIs).
