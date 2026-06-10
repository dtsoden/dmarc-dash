# DMARC Dashboard

A self-hosted DMARC aggregate-report dashboard. It pulls DMARC `rua` aggregate
reports from a single Office 365 / Microsoft 365 mailbox via Microsoft Graph,
parses them, stores the results in a local SQLite database, and presents them in
a multi-user web dashboard with a geographic source map and scheduled email
digests.

## What it does

- Polls one mailbox on a configurable interval and ingests every DMARC
  aggregate report it finds (gzip, zip, or plain XML attachments).
- Parses both common DMARC report namespaces, deduplicates by report id, and
  captures any unrecognized fields so nothing is silently dropped.
- Normalizes everything into a queryable schema and drives six dashboard views:
  overview, sources, reports, per-report detail, policy, and the ingest log.
- Plots sending sources on a world map using a local MaxMind GeoLite2 database.
- Sends weekly and monthly digest emails through MailerSend.
- Supports multiple users with role-based access (admin, analyst, viewer),
  a first-run Setup Wizard, and self-service password reset.

## How it compares to Postmark DMARC Digests Premium

| Capability                     | Postmark DMARC Digests Premium | DMARC Dashboard |
| ------------------------------ | ------------------------------ | --------------- |
| Ingests all reporting sources  | Yes                            | Yes             |
| Interactive dashboard          | Yes                            | Yes             |
| Historical retention           | Limited window                 | Unlimited (your own DB) |
| Geographic source map          | No                             | Yes             |
| Weekly / monthly email digests | Weekly only                    | Weekly + monthly |
| Multi-user with roles          | No                             | Yes (admin / analyst / viewer) |
| Self-hosted, data stays local  | No                             | Yes             |

In short: it matches Postmark on all-sources ingestion and a full dashboard,
exceeds it on retention, and adds a geo map, monthly digests, and multi-user
access.

## First run: the Setup Wizard

There is no secrets `.env` to edit. Start the app, open it in a browser, and the
first run redirects you to the **Setup Wizard**. In the wizard you:

1. Create the initial **admin** account.
2. Enter the Microsoft Graph credentials (tenant id, client id, client secret)
   and the DMARC mailbox UPN, with a built-in "Test connection" button.
3. Choose the poll interval and the delete mode for processed mail.
4. Optionally enter the MailerSend token and from-address, the digest recipients,
   and your MaxMind license key.

All of these values are stored encrypted in the database. Nothing sensitive lives
in an env file.

For registering the Entra (Azure AD) app and scoping it to a single mailbox, see
[docs/SETUP-ENTRA.md](docs/SETUP-ENTRA.md).

## Environment variables

The application reads only two environment variables. Everything else is
configured in the Setup Wizard.

| Variable   | Default        | Purpose |
| ---------- | -------------- | ------- |
| `DATA_DIR` | `./data`       | Directory holding `dmarc.db`, `GeoLite2-City.mmdb`, and `app.key`. |
| `PORT`     | `3000`         | HTTP port the server listens on. |

## Roles

- **admin**: full access, including Settings and user management.
- **analyst**: full read access to all dashboard data.
- **viewer**: read-only access to the dashboard.

Only admins can reach `/settings` and `/users`. Non-admins are blocked from those
routes.

## Forgot password

The login page offers a **Forgot password** flow. A user requests a reset, the app
issues a time-limited reset link, and the user sets a new password from that link.

## Common tasks

Fetch (or refresh) the GeoLite2 city database used by the source map. This reads
the MaxMind key from your saved settings, falling back to the
`MAXMIND_LICENSE_KEY` env var:

```bash
npm run fetch:geo
```

Send a digest on demand:

```bash
npm run digest -- weekly
npm run digest -- monthly
```

Run a single poll cycle immediately (instead of waiting for the scheduler):

```bash
npm run poll:once
```

## Running with Docker

The whole application ships as a single container with one mounted data volume.

```bash
docker compose up -d
```

The container starts, the scheduler begins polling on its configured interval,
and `http://localhost:3000` redirects you to the Setup Wizard on first run. No
secrets `.env` is required; all configuration is entered in the wizard and stored
(encrypted) in the database on the mounted `./data` volume.

## Polling, digests, and mail handling

- **Configurable poll interval**: set in Settings and applied live. Changing it
  re-schedules the poller without a restart.
- **Digests**: weekly and monthly summary emails are sent through MailerSend to
  the recipients you configure.
- **Safe delete**: after a report is successfully ingested, its source email is
  removed or moved according to your delete mode. Messages that fail to parse are
  never deleted; they are moved to a `DMARC-Errors` folder in the mailbox so you
  can inspect them.

## Backups: protect `data/app.key`

All secrets (Graph client secret, MailerSend token, MaxMind key, and so on) are
encrypted at rest with the key stored in `data/app.key`. Back this file up along
with your database. If you lose `app.key`, the encrypted secrets in the database
can no longer be decrypted and you will have to re-enter them through the Setup
Wizard or Settings.
