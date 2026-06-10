# Operations Notes, Gotchas, and Hard-Won Lessons

Running log of real issues hit during build/first-deploy and how they were resolved. This
is the source material for the polished README / setup / operations docs. Keep it honest.

## 1. Mailbox access (Microsoft 365)

- **Graph app-only, not IMAP.** O365 retired Basic Auth for IMAP/POP/SMTP (app passwords
  dead as of 2026-04-30), so OAuth2 is mandatory. We use Microsoft Graph app-only
  (client credentials), `Mail.ReadWrite`.
- **Admin consent is the #1 setup trap.** After adding the `Mail.ReadWrite` *Application*
  permission you MUST click "Grant admin consent" and see it turn green. Symptom when
  missed: Graph returns **"Access is denied. Check credentials and try again."** That
  message is misleading, it means the token was issued fine (tenant/client/secret are
  correct) but the app is not *authorized*. Causes, in order: (1) admin consent not
  granted, (2) consent granted but not yet propagated (wait 5-15 min), (3) the mailbox
  UPN isn't a real licensed/Exchange mailbox.
- **Mailbox (UPN) is just the email address.** No Graph Explorer needed. It's the address
  of the mailbox that receives DMARC reports, e.g. `dmarc@beaconspec.com`.
- Doc TODO: the wizard's Graph step now has an inline "How do I get these values?" panel;
  keep README pointing at `docs/SETUP-ENTRA.md` for the full walkthrough + the
  Application Access Policy lockdown.

## 2. Dedicated mailbox vs real mailbox (IMPORTANT)

- The tool is meant for a **dedicated DMARC mailbox**. Pointing it at a real/working
  mailbox is risky by design intent (it deletes reports it ingests).
- **A dedicated mailbox is FREE on M365: use a shared mailbox.** Exchange Online shared
  mailboxes need **no license** under 50 GB (no archive/litigation hold). They receive
  external mail and are readable by Graph app-only (scope with an Application Access
  Policy). Tenant just needs >=1 licensed user. DMARC reports are tiny, 50 GB is never a
  concern.
- Setup: M365 admin center -> Teams & groups -> Shared mailboxes -> Add (e.g.
  `dmarc@beaconspec.com`, no license). Then point the domain's DMARC `rua=` at it and set
  the app's Mailbox (UPN) to it.
- Same-domain `rua`/`ruf` (mailbox in the same domain as `_dmarc`) needs no external
  authorization record.

## 3. THE INCIDENT: tool swept a real inbox (fixed)

- **What happened:** on a real mailbox, the first version processed *every* inbox message:
  it ingested+deleted the one real DMARC report, and **moved all other mail** (normal
  emails, `.txt` attachments, no-attachment emails) into a new `DMARC-Errors` folder.
  Looked like the inbox was nuked.
- **Nothing was permanently lost:** deletes are soft (-> Deleted Items, recoverable
  ~14-30 days); the rest were just *moved* to `DMARC-Errors`. Recovery: in Outlook, open
  `DMARC-Errors` -> select all -> Move to Inbox; check Deleted Items / "Recover items".
- **Root cause:** logic was "anything that doesn't parse as DMARC -> move to DMARC-Errors."
  Wrong for a non-dedicated mailbox.
- **Fix (committed):** `processMailbox` now only acts on an email that is a genuine DMARC
  report, identified by a report-type attachment (`.xml`/`.xml.gz`/`.gz`/`.zip`) or a
  `Report Domain:` subject. **Ordinary mail is never parsed, moved, or deleted.** Only a
  genuine-but-unparseable report goes to `DMARC-Errors`. Locked in by tests
  (`tests/mailbox.test.ts`: a plain email and a `.pdf` email are left untouched even in
  hard mode).
- Doc TODO: README must state plainly, "Use a dedicated/shared mailbox," and explain the
  delete + DMARC-Errors behavior up front.

## 4. Setup wizard

- All config is DB-backed (no env secrets); the first-run wizard creates the admin and
  writes settings (secrets AES-encrypted via `data/app.key`).
- **Validation was a black box (fixed).** Early wizard dumped a raw zod JSON blob on any
  bad field and only failed at the final step (e.g. password < 8 chars), causing many
  retries. Now: per-step validation with plain-English errors, readable server errors,
  field labels, and a "Saving..." state.
- Doc TODO: note the admin password minimum (8), that there are no default credentials,
  and that the only env vars are `DATA_DIR` and `PORT`.

## 5. GeoIP map (optional, and fiddly)

- Uses MaxMind **GeoLite2** (FREE, no payment) but gated behind a free MaxMind account +
  "license key." The "license key" wording reads as commercial but GeoLite2 is the free
  tier; GeoIP2 is the paid one (not used).
- **MaxMind outages** break account signup / password reset / confirmation emails
  (their status page). If a user "can't get the email," suspect their outage, not the
  user.
- **The key alone is not enough.** The actual `.mmdb` database still has to be downloaded
  (`npm run fetch:geo`), it is NOT auto-fetched on key save. Until then the map won't
  render (everything else works).
- **No-account alternative:** DB-IP "IP to City Lite" (free, no key, MMDB format) can be
  dropped into `data/GeoLite2-City.mmdb`.
- Doc TODO + product TODO: either auto-download the DB when the key is saved, or natively
  support DB-IP so customers never touch MaxMind. Until then, document GeoIP as optional
  and the database-download step explicitly.

## 6. Deployment (Docker)

- One container, single mounted `data/` volume holding `dmarc.db`, `GeoLite2-City.mmdb`,
  and `app.key`. **Back up `app.key`**, losing it makes encrypted secrets unrecoverable
  (the app now refuses to start on a corrupt key rather than silently regenerating).
- **Port:** compose maps host `9693 -> 3000` here because host 3000 was taken by another
  stack (cl-frontend). Default is 3000; change the mapping per host.
- **`npm ci` needs `.npmrc` with `legacy-peer-deps=true`** (react-simple-maps declares
  React 16-18 peers; we run React 19). The Dockerfile copies `.npmrc` into the deps stage.
- **Instrumentation location bug (fixed):** the cron scheduler boots from
  `src/instrumentation.ts`. It was wrongly placed at `src/app/instrumentation.ts`, so the
  poller silently never ran. Symptom: no `[scheduler] started` line in container logs.
- **Standalone output:** `outputFileTracingRoot` is pinned to the project so
  `.next/standalone/server.js` is always flat (a stray parent `package.json` on the host
  otherwise nests it and breaks the Docker `CMD`).
- Next.js 16 / React 19 (scaffold pulled latest, not 15). No code changes needed for that.

## 7. Polling and reports

- Poll interval is a UI setting (minutes), re-scheduled live on save. Tip: set to 1 while
  testing.
- **"Poll now" button** (admin/analyst) added so you don't wait for the timer; `/api/poll/run`.
- **Aggregate reports arrive ~once per day** per reporter, so a freshly-pointed mailbox
  fills over ~24h, not instantly. Don't expect immediate data after a DNS change.

## 8. DNS (Cloudflare)

- DMARC record lives at `_dmarc.<domain>` TXT. To route reports to the dedicated mailbox,
  change `rua=` (and `ruf=`) to the shared mailbox, preserving the policy
  (`p`/`sp`/`pct`/`adkim`/`aspf`).
- **wrangler does NOT manage DNS records** (Workers/Pages tool). DNS edits go through the
  Cloudflare dashboard or the Cloudflare API with a token scoped to Zone -> DNS -> Edit.
  In this environment `wrangler whoami` failed on account permissions and no
  `CLOUDFLARE_API_TOKEN` was set, so the DNS change was left to the dashboard / a scoped
  token.

## 8b. Multi-domain mailbox monitoring

- Each monitored domain is a row in the `mailbox_source` table: `domain` (unique,
  validated), `provider` (graph|imap), that provider's credentials (secrets AES-encrypted
  with the app key, same as settings), plus `last_poll_at/status/detail` for per-mailbox
  health. CRUD via `/api/sources` (admin); test via `/api/sources/test` ({id} = stored
  creds, or full creds for an unsaved one, works in the wizard too).
- **One global poll interval.** Each tick the scheduler polls ALL active sources
  **concurrently** (`Promise.allSettled`); one broken/slow mailbox never blocks the
  others, and its error is recorded on the source row + shown in Settings.
- **Legacy migration:** older single-mailbox installs (flat `mailbox_provider`/`graph_*`/
  `imap_*` settings) are migrated into the first `mailbox_source` row at scheduler boot.
  If `mailbox_provider` was never set, the provider is inferred from whichever credentials
  exist. Idempotent.
- Dashboards stay **aggregate across all domains** with the existing domain filter; the
  per-report domain still comes from the XML, so one mailbox can serve several domains.
- Wizard configures the FIRST domain; add more under Settings -> Mailbox Monitoring.

## 8c. White-label branding

- Per-mode brand color: `brand_color_light` / `brand_color_dark` drive buttons, active
  tabs, links, focus ring, and the logo mark; button/logo text auto-contrasts by
  luminance. `brand_default_theme` (light|dark) is the admin default theme (a user's own
  toggle overrides per browser). `brand_app_name`, plus uploaded `logo`/`favicon` served
  from `/api/brand/{kind}` (files in `<DATA_DIR>/brand/`). Injected as CSS variables in the
  root layout at runtime. Configurable in Settings -> Branding AND the wizard branding step.

## 8d. User invites (no emailed passwords)

- Adding a user is **disabled unless outbound email (MailerSend) is configured** (the UI
  auto-detects and greys out the form; the API refuses with a clear message).
- New users receive a **single-use, 7-day token link** (reusing the password-reset token
  table) to set their own password. No password is ever emailed.

## 8e. Tables (Ingest Log, Reports)

- Server-driven pagination (25/50/100), sortable columns (allowlisted, injection-safe),
  and search/filter via URL params (`q`, `status`/`domain`, `sort`, `dir`, `page`,
  `pageSize`). Report drill-in is intentionally un-paginated (few records).

## 8f. DNS authentication report (read-only)

- Reports -> DNS Report queries SPF, DMARC, DKIM, MX, BIMI, MTA-STS, TLS-RPT for a domain
  via public DNS (1.1.1.1/8.8.8.8). DKIM selectors are auto-discovered from
  `auth_result_dkim` (observed in ingested reports). Query-only; never changes DNS.

## 9. Roles / security (for the admin guide)

- Roles: Administrator (everything), Analyst (dashboards + manual poll + export), Viewer
  (read-only). No self-registration; admins add users; forgot-password via MailerSend.
- Last admin can't be deleted/demoted/deactivated. Secrets encrypted at rest; Settings
  API masks secrets and never returns them to the browser. Wizard test endpoints are
  guarded once setup is complete.
