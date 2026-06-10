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
- **All configuration lives in the database, set through the UI — not env vars.** A
  **first-run setup wizard** collects Graph credentials, mailbox, poll interval, email,
  and MaxMind key, and creates the first administrator. The only environment input is the
  data directory (where the DB and the app encryption key live). No default credentials
  ship; the admin is created in the wizard.
- **Multi-user with roles** (Administrator / Analyst / Viewer), admin-managed user CRUD,
  **forgot-password** via email, and **no self-registration** (only an admin adds users).
- **Secrets encrypted at rest.** Passwords are bcrypt-hashed; secret settings (Graph
  client secret, MailerSend token) are AES-256-GCM encrypted in the DB with a key
  auto-generated into the data volume on first run.
- **GeoIP map included**, using MaxMind GeoLite2 (license key set in Settings).
- **Email digests (weekly + monthly)** via MailerSend, to a configured recipient list.
  This closes the main gap vs. Postmark DMARC Digests Premium.
- **Poll interval is a UI setting** (minutes), applied live without a restart.
- **Deployment: local Docker now** (single data volume), portable to EasyPanel later.

## 3. Architecture

Single Next.js app, one container, two cooperating halves sharing the codebase and DB:

1. **Ingest worker** — `node-cron` job whose interval comes from the DB settings
   (default 15 minutes). Authenticates app-only to Graph using credentials read from
   settings, pulls reports from the Inbox, parses, stores, deletes the email. The job is
   re-scheduled live whenever the interval setting changes.
2. **Dashboard + admin** — SSR pages (shadcn/ui + Tailwind + Recharts) behind login with
   role-based access, plus a setup wizard, a Settings area, and User management.

The SQLite DB, the GeoLite2 DB, and the app encryption key all live on a single mounted
data volume so data and config survive container restarts.

### Configuration model

- **Settings service** reads typed values from a `setting` table (key/value/type), with
  an in-memory cache invalidated on write. Secret-typed settings are transparently
  decrypted on read and encrypted on write.
- **Bootstrap env (only):** `DATA_DIR` (default `data`) and optional `PORT`. Everything
  else (Graph creds, mailbox, poll interval, delete mode, MailerSend, MaxMind, schedules)
  is a setting edited in the wizard/Settings UI.
- **App encryption key:** 32 random bytes written to `<DATA_DIR>/app.key` on first run
  (0600). Used for AES-256-GCM of secret settings. Losing it means re-entering secrets.
- **First-run detection:** if no administrator exists, every route redirects to `/setup`.

## 4. Ingestion pipeline

1. **Auth**: MSAL client-credentials flow → app-only token, using tenant/client/secret/
   mailbox read from settings (entered in the wizard, not env). Requires a one-time Entra
   app registration with `Mail.ReadWrite`, scoped to just the target mailbox via an
   Exchange Application Access Policy. A step-by-step setup doc will be produced, and the
   wizard provides a "Test connection" button.
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

Config / identity tables:

- `setting` — `key` (PK), `value` (TEXT, encrypted if secret), `type`
  (`string|int|bool|secret|json`), `updated_at`. Single source of truth for all runtime
  config.
- `app_user` — `id`, `username` (unique), `email` (unique), `password_hash` (bcrypt),
  `role` (`admin|analyst|viewer`), `is_active`, `must_change_password`, `created_at`,
  `last_login_at`.
- `password_reset` — `id`, `user_id` FK, `token_hash`, `expires_at`, `used_at`. Tokens
  are random, stored hashed, single-use, short-lived.

Notes:
- Store enums as TEXT, unconstrained (real reporters emit out-of-spec values).
- Keep BOTH the DMARC-aligned pass/fail (`policy_evaluated` → `dkim_aligned`,
  `spf_aligned`) and the raw SPF/DKIM auth results — they are different concepts.
- `count` is the additive measure for nearly every KPI (`SUM(count)` grouped by a
  dimension).

## 5a. Users, roles, and access

Three roles:

- **Administrator** — full access: dashboards, Settings, User management, manual poll,
  test connection / test digest.
- **Analyst** — dashboards + manual "poll now" + data export. No Settings, no Users.
- **Viewer** — read-only dashboards. No actions, no admin areas.

Auth and lifecycle:

- **Login** with username (or email) + password; iron-session cookie carrying `userId`
  and `role`. Role checked in middleware and in each admin route/server action.
- **No self-registration.** Admins create users (set role, email, temporary password with
  `must_change_password`). Users can be deactivated or deleted.
- **Forgot password**: user submits email → if it matches an active user and email is
  configured, a single-use reset link (hashed token, short expiry) is emailed via
  MailerSend → reset page sets a new bcrypt password. If email isn't configured, the page
  says so and an admin must reset it manually.
- **Change password** available to any logged-in user; forced when
  `must_change_password` is set.

## 5b. Setup wizard (first run)

When no administrator exists, all traffic redirects to `/setup`. Steps:

1. **Create administrator** — username, email, password.
2. **Microsoft Graph** — tenant ID, client ID, client secret, mailbox UPN, with a "Test
   connection" button (lists the inbox to confirm access).
3. **Polling** — interval in minutes (default 15), delete mode (safe/hard).
4. **Email (optional)** — MailerSend token, from-address, digest recipients, weekly/
   monthly schedules, with a "Send test email" button.
5. **GeoIP (optional)** — MaxMind license key.

On completion the wizard writes settings (secrets encrypted), creates the admin, marks
`setup_complete=true`, and starts the scheduler. Everything here is later editable in
**Settings** (admin only); saving the interval re-schedules the poller live.

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

Scheduled summary emails sent via MailerSend (REST API). The token, from-address,
recipients, and schedules are all **settings** entered in the wizard/Settings UI (the
token at `C:/Users/DavidSoden/registry/email_access_token.txt` is pasted in during
setup, not committed).

- **Weekly** and **monthly** digests on their own cron schedules (settings).
- Content: overall DMARC/SPF/DKIM compliance %, total volume, quarantined/rejected
  counts, top sending sources (pass/fail), new sources first seen in the period, and
  trend vs. the previous period. HTML email built from the same query layer the
  dashboard uses.
- Recipients default to `david.soden@beaconspec.com, duane.walker@beaconspec.com`
  (editable in Settings).
- A "Send test email" button in Settings/wizard and a one-shot `npm run digest --
  weekly|monthly` command are provided for manual sends and testing.
- The same MailerSend integration powers forgot-password reset emails.

## 9. Configuration

Runtime config is **DB-backed settings** (see Configuration model in §3), edited via the
wizard/Settings UI. Settings keys include: `setup_complete`, `graph_tenant_id`,
`graph_client_id`, `graph_client_secret` (secret), `mailbox_upn`, `poll_interval_minutes`
(default 15), `delete_mode` (safe|hard), `mailersend_token` (secret), `mailersend_from`,
`digest_recipients`, `digest_weekly_cron`, `digest_monthly_cron`, `maxmind_license_key`
(secret).

Environment is minimal and infrastructural only:

```
DATA_DIR=data    # holds dmarc.db, GeoLite2-City.mmdb, app.key
PORT=3000        # optional
```

## 10. Out of scope (v1)

Schema leaves room but these are not built now:
- Forensic / failure (RUF / AFRF) reports.
- SMTP TLS Reporting (TLS-RPT, JSON, RFC 8460).
- Recommendations engine and instant (non-digest) alerts.
- SSO / external identity providers (local accounts only for now).

## 11. References

- RFC 7489 Appendix C (legacy aggregate schema).
- RFC 9990 — DMARC Aggregate Reporting (DMARCbis, current standard).
- RFC 9989 — DMARC core; RFC 9991 — Failure Reporting.
- Microsoft: deprecation of Basic Auth in Exchange Online; OAuth2 for IMAP/SMTP.
- parsedmarc (reporter quirks, lenient parsing) and dmarc-visualizer / Grafana DMARC
  dashboards (KPIs).
