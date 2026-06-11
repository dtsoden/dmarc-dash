# Changelog

All notable changes to DMARC Dashboard are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged `vMAJOR.MINOR.PATCH` and published on GitHub.

## [Unreleased]

### Added

- **Documentation search.** The bundled docs now have full-text search, built into the
  static output at build time and fully client-side, so it works self-hosted with no
  external service.

## [0.1.1] - 2026-06-11

### Added

- **Public landing page.** Set `LANDING=1` to serve a marketing page at `/` for anonymous
  visitors, with navigation linking to the docs, GitHub, the latest release download, and
  the login screen. Signed-in users still go straight to the dashboard. The variable's
  absence (the default) keeps the page off.
- **Brand logo on the sign-in screens.** The login, forgot-password, and reset pages now
  show the uploaded logo (or the app name) like the rest of the app, instead of a
  hardcoded product name.

### Changed

- Fresh installs no longer prefill the digest from-address or recipients; both start empty.

## [0.1.0] - 2026-06-11

First tagged release. A self-hosted DMARC aggregate report dashboard.

### Added

- **Report ingestion.** Parses DMARC aggregate reports (RFC 7489 and DMARCbis) from
  `.xml`, `.xml.gz`, `.gz`, and `.zip` attachments into a local SQLite database.
- **Mailbox monitoring.** Microsoft 365 (Graph, app-only) and IMAP (Gmail / Workspace and
  other providers) sources. Multiple domains, each polled concurrently on one global
  interval, with per-mailbox status and a Poll now button.
- **Safe delete.** Only genuine DMARC report emails are ever touched. Reports that fail to
  parse go to a `DMARC-Errors` folder (safe mode) or are deleted (hard mode); ordinary mail
  is never parsed, moved, or deleted.
- **Monitoring views.** Overview KPIs with a volume-by-day chart, Authentication (SPF/DKIM
  alignment), Policy (disposition breakdown), Reports (list plus per-source detail), and an
  Ingest Log, all filterable by domain and date range.
- **DNS report.** Read-only checks for SPF, DMARC, DKIM, MX, BIMI, MTA-STS, and TLS-RPT,
  with DKIM selectors auto-discovered from ingested reports.
- **GeoIP source map.** Optional world map of sending IPs (MaxMind GeoLite2, auto-downloaded
  when a license key is saved).
- **Setup wizard.** First-run wizard that either sets up a new system or restores from a
  backup. Configuration is stored in the database; no environment variables beyond
  `DATA_DIR` and `PORT`.
- **Encrypted secrets.** All credentials and tokens are encrypted at rest with AES-256-GCM
  using a key on the data volume (`app.key`).
- **Users and roles.** Admin, analyst, and viewer roles; token-based invites valid for 7
  days; self-service password reset. Adding users requires email to be configured.
- **Notifications.** MailerSend-powered weekly and monthly digests, user invites, and
  password resets. Digest schedules are set with friendly day/time pickers (no cron syntax),
  each independently on or off.
- **White-label branding.** Per-mode brand colors, default theme, app name, and logo /
  favicon uploads.
- **Backup and restore.** Download the entire data volume as one zip, and restore it (from
  Settings or the setup wizard) to migrate or clone an instance, encryption key included.
- **Bundled documentation.** Full docs served at `/docs`, with contextual links throughout
  the app.
- **Mobile support.** Responsive layout with a hamburger navigation drawer.
- **Deployment.** Single Docker container with one mounted data volume; Cloudflare Tunnel
  friendly.

[Unreleased]: https://github.com/dtsoden/dmarc-dash/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/dtsoden/dmarc-dash/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/dtsoden/dmarc-dash/releases/tag/v0.1.0
