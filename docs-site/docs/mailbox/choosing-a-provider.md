---
sidebar_position: 1
title: Choosing a Provider
---

# Choosing a Provider

Each monitored domain reads its DMARC reports from one mailbox, using one of two mutually exclusive connection methods. The right choice is determined entirely by where the mailbox lives.

## Decision matrix

| Mailbox host                              | Connection method                | What you provide                                          |
| ----------------------------------------- | -------------------------------- | --------------------------------------------------------- |
| **Microsoft 365 / Exchange Online**       | **Microsoft Graph (app-only)**   | Tenant ID, Client ID, Client Secret, mailbox UPN          |
| **Google Workspace / Gmail**              | **IMAP + App Password**          | `imap.gmail.com:993`, full address, App Password          |
| **Generic IMAP (Fastmail, etc.)**         | **IMAP + App Password**          | host:port, full address, App Password                     |

The methods are exclusive per domain. You pick one when you add the domain.

## Why Microsoft 365 must use Graph

Microsoft has disabled Basic Authentication for IMAP, POP, and SMTP in Exchange Online. There are **no app passwords for Exchange Online IMAP**. The only supported way for an unattended application to read a Microsoft 365 mailbox is OAuth2 via Microsoft Graph, using app-only (client credentials) authentication with the `Mail.ReadWrite` permission.

:::danger Microsoft 365 IMAP will fail
Do not try to connect a Microsoft 365 / Exchange Online mailbox over IMAP. Basic Auth IMAP is turned off tenant-wide and there is no app-password path. The connection will fail with errors like "Command failed" or an authentication failure. Use the **Microsoft Graph** provider instead. See [Microsoft 365](./microsoft-365.md).
:::

## Why Google and others use IMAP + App Password

Google Workspace and Gmail support unattended IMAP access, but only with an **App Password**, and only after **2-Step Verification** is enabled on the account. Google disabled legacy password-only IMAP ("less secure app access") in 2025, so your normal account password will not work.

Generic IMAP servers such as Fastmail work the same way: enable an app-specific password and connect over IMAP/SSL (typically port `993`).

See [IMAP](./imap.md) for the step-by-step.

## Use a dedicated mailbox

Whichever provider you choose, point the domain's DMARC `rua=` at a **dedicated** mailbox, not someone's working inbox. DMARC Dashboard soft-deletes the reports it ingests, so a dedicated mailbox keeps that activity isolated.

:::tip A dedicated Microsoft 365 mailbox is free
An Exchange Online **shared mailbox** needs no license under 50 GB. It receives external mail and is readable by Graph app-only. DMARC reports are tiny, so 50 GB is never a concern. See [Microsoft 365](./microsoft-365.md#free-shared-mailbox).
:::
