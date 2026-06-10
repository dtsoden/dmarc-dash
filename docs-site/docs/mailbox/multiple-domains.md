---
sidebar_position: 4
title: Multiple Domains
---

# Multiple Domains

DMARC Dashboard monitors as many domains as you like. The Setup Wizard configures the first domain; you add the rest under **Settings -> Mailbox Monitoring**.

## How multi-domain works

- **Each domain is its own mailbox source.** A source is one domain plus the credentials (Graph or IMAP) for the mailbox that receives that domain's reports. Each domain can use a different provider.
- **One global poll interval.** There is a single interval setting that applies to every mailbox. You do not schedule domains individually.
- **All mailboxes are polled concurrently.** On each tick the scheduler polls every active source at the same time. One slow or broken mailbox never blocks the others; its error is recorded against that source and shown in Settings.
- **Dashboards stay aggregate.** The dashboards combine data across all domains, with a domain filter. The per-report domain comes from the report XML itself, so a single mailbox can even serve several domains.

## Add a domain

1. Go to **Settings -> Mailbox Monitoring**.
2. Click the **Add domain** button. It reveals a form for a new mailbox source.
3. Enter the **domain**, choose the **provider** (Microsoft 365 / Graph or IMAP), and enter its credentials. See [Microsoft 365](./microsoft-365.md) or [IMAP](./imap.md).
4. Use **Test connection** to confirm the credentials reach the mailbox.
5. Save. The new source joins the next poll cycle.

## Per-mailbox status

Settings -> Mailbox Monitoring shows each source's last poll result: when it last ran, whether it succeeded, and the error detail if it failed. Use this to spot a domain whose credentials have expired (for example, an expired Graph client secret or a revoked App Password).

## Switch or remove a domain

- **Change credentials or provider:** edit the source in place and re-test.
- **Remove a domain:** delete its source. The historical reports already ingested for that domain remain in the dashboards; only future polling stops.

:::tip
Point each domain's DMARC `rua=` at the correct mailbox before relying on its dashboard. Reports flow only after the DNS change propagates, and aggregate reports arrive about once per day per reporter.
:::
