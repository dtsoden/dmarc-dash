---
sidebar_position: 9
title: DNS Report
---

# DNS Report

The DNS Report (under **Reports -> DNS Report**) gives you a read-only view of a domain's email authentication records. It queries public DNS and reports what it finds. It is **query-only**: it never changes any DNS record.

## What it checks

For a given domain, the DNS Report looks up:

| Record    | What it is                                             |
| --------- | ------------------------------------------------------ |
| **SPF**   | Sender Policy Framework (authorized senders)           |
| **DMARC** | The `_dmarc` policy record (`p`, `rua`, etc.)          |
| **DKIM**  | DKIM public keys for discovered selectors              |
| **MX**    | Mail exchanger records                                 |
| **BIMI**  | Brand Indicators for Message Identification            |
| **MTA-STS** | SMTP MTA Strict Transport Security policy            |
| **TLS-RPT** | SMTP TLS Reporting                                    |

## DKIM selector auto-discovery

DKIM keys live at selector-specific names, so checking DKIM normally requires knowing the selectors. DMARC Dashboard **auto-discovers selectors** from the DKIM results observed in your already-ingested DMARC reports, then queries those selectors for the domain. The more reports you ingest, the more complete the DKIM picture becomes.

## How it queries

Lookups go to public resolvers (such as `1.1.1.1` and `8.8.8.8`). The report reflects what those resolvers return at query time.

:::info Read-only
The DNS Report never edits, creates, or deletes DNS records. To change a record (for example, to repoint `rua=` at your dedicated mailbox), use your DNS provider's dashboard or API. See [Polling and Safe-Delete](./polling-and-safe-delete.md) for what the dashboard does after reports arrive.
:::
