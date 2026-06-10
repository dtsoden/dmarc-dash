---
slug: /
sidebar_position: 1
title: DMARC Dashboard
---

# DMARC Dashboard

DMARC Dashboard is a self-hosted application for monitoring DMARC aggregate reports. It collects the daily XML reports that mailbox providers send to your DMARC `rua=` address, parses them, and turns them into dashboards so you can see who is sending mail "as" your domains, whether that mail passes SPF and DKIM alignment, and where it originates geographically.

## The big picture

You point your domain's DMARC record at a dedicated mailbox. DMARC Dashboard connects to that mailbox, polls it on a schedule, ingests every genuine DMARC report it finds, and stores the results in a local database. From there you get:

- Aggregate dashboards across one or many domains, with a domain filter.
- A geographic source map of sending IPs (optional, via MaxMind GeoLite2).
- A read-only DNS authentication report (SPF, DMARC, DKIM, MX, BIMI, MTA-STS, TLS-RPT).
- Weekly and monthly digest emails (optional, via MailerSend).
- Multi-user access with three roles, white-label branding, and more.

## Designed for simple operation

- **All configuration lives in the app.** A first-run Setup Wizard creates your admin account and writes every setting to a local database. The only environment variables are `DATA_DIR` and `PORT`.
- **Runs anywhere Docker runs.** One container, one `data/` volume.
- **Safe by design.** The ingester only ever touches genuine DMARC report emails. Ordinary mail is never parsed, moved, or deleted.

:::tip
Use a dedicated mailbox for DMARC reports. On Microsoft 365 a shared mailbox is free and works perfectly. See [Choosing a Provider](./mailbox/choosing-a-provider.md).
:::

## Next steps

Head to [Getting Started](./getting-started.md) to deploy the container and run the Setup Wizard.
