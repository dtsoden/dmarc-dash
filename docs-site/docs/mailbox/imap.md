---
sidebar_position: 3
title: IMAP
---

# IMAP (App Password)

Use the IMAP provider for Google Workspace / Gmail and for any generic IMAP host (Fastmail, and others). DMARC Dashboard connects over IMAP/SSL and reads the DMARC reports from the mailbox.

:::danger Your normal account password will not work
Every modern IMAP provider requires an **App Password** (also called an app-specific password) for unattended access. The regular password you type to sign in interactively will be rejected. Generate an App Password as shown below.
:::

:::warning Microsoft 365 cannot use this path
Exchange Online has Basic Auth IMAP disabled tenant-wide, with no app passwords. Microsoft 365 mailboxes must use the [Microsoft Graph](./microsoft-365.md) provider. See [Choosing a Provider](./choosing-a-provider.md).
:::

## Google Workspace / Gmail

1. **Enable 2-Step Verification** on the account that owns the DMARC mailbox. App Passwords are only available once 2-Step Verification is on. (Google disabled legacy password-only IMAP in 2025.)
2. Go to the account's **App Passwords** page (Google Account -> Security -> App passwords).
3. Generate a new App Password. Google shows a 16-character value, e.g. `abcd efgh ijkl mnop`. Copy it (you can omit the spaces).
4. In DMARC Dashboard, choose the **IMAP (App Password)** provider and enter:

   | Field    | Value                          |
   | -------- | ------------------------------ |
   | Host     | `imap.gmail.com`               |
   | Port     | `993`                          |
   | Username | the full address, e.g. `dmarc@yourdomain.com` |
   | Password | the **App Password** from step 3 |

5. Click **Test connection**, then save.

## Generic IMAP (Fastmail and others)

Any standard IMAP server works the same way. Create an app-specific password in your provider's settings, then enter the server's IMAP host and port.

Example for Fastmail:

| Field    | Value                                   |
| -------- | --------------------------------------- |
| Host     | `imap.fastmail.com`                     |
| Port     | `993`                                   |
| Username | the full address, e.g. `dmarc@yourdomain.com` |
| Password | a Fastmail **app password**             |

Most providers use port `993` for IMAP over SSL/TLS. Check your provider's documentation for the exact host and for where to generate app passwords.

## After connecting

Once the connection tests succeed, the mailbox is polled on the global interval. Reports are ingested and soft-deleted; ordinary mail is left untouched. See [Polling and Safe-Delete](../polling-and-safe-delete.md).
