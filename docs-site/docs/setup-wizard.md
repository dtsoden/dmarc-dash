---
sidebar_position: 3
title: Setup Wizard
---

# Setup Wizard

On first run, DMARC Dashboard redirects to the Setup Wizard. It creates your administrator account and writes every setting to the database. Secrets are AES-encrypted at rest using `data/app.key`. There are no default credentials and no secret-bearing environment variables.

Each step validates its own fields with plain-English errors, so you fix problems as you go rather than at the end.

:::info
Once setup is complete, the wizard's test endpoints are locked. You manage everything afterward from **Settings**.
:::

## Step 1: Administrator account

Create the first admin. This account can do everything: manage users, mailboxes, notifications, branding, and all settings.

- Username.
- Email address.
- Password (minimum 8 characters).

The last remaining administrator cannot later be deleted, demoted, or deactivated.

## Step 2: Mailbox source

Configure the first domain to monitor. A mailbox source is one domain plus the credentials to read its DMARC mailbox.

1. **Domain**, e.g. `yourdomain.com`.
2. **Provider**, one of:
   - **Microsoft 365 (Microsoft Graph)** for Exchange Online mailboxes. See [Microsoft 365](./mailbox/microsoft-365.md).
   - **IMAP (App Password)** for Gmail / Google Workspace and any generic IMAP server. See [IMAP](./mailbox/imap.md).
3. The provider-specific credentials:
   - **Graph:** Tenant ID, Client ID, Client Secret, and the mailbox UPN (the mailbox's email address).
   - **IMAP:** host and port (e.g. `imap.gmail.com:993`), username (full email address), and the App Password.

:::tip Use the "Test connection" button
Each provider step has a **Test connection** button. Use it before continuing: it confirms the credentials actually reach the mailbox, so you don't finish the wizard only to discover a typo.
:::

The provider choice is mutually exclusive per domain. Microsoft 365 mailboxes must use Graph; IMAP will fail against them. See [Choosing a Provider](./mailbox/choosing-a-provider.md) for why.

You can add more domains later under **Settings -> Mailbox Monitoring**. See [Multiple Domains](./mailbox/multiple-domains.md).

## Step 3: Polling and delete mode

- **Poll interval (minutes):** one global interval applies to all mailboxes. Set it to `1` while testing, then raise it for production.
- **Delete mode (on parse failure):** controls what happens to a genuine DMARC report that cannot be parsed. In **safe** mode (the default) it is moved to a `DMARC-Errors` folder for review; in **hard** mode it is deleted anyway. A report that ingests successfully is always soft-deleted (moved to Deleted Items) regardless of this setting, and ordinary mail is never touched. See [Polling and Safe-Delete](./polling-and-safe-delete.md).

## Step 4: Notifications (optional)

Configure MailerSend to enable weekly/monthly digests, user invites, and password resets.

- MailerSend API token.
- A verified from-address.
- Digest recipients.

:::warning
Adding users later requires notifications to be configured, because new users receive an emailed invite link rather than a password. See [Users and Roles](./users-and-roles.md).
:::

You can skip this and configure it later in **Settings -> Notifications**.

## Step 5: GeoIP (optional)

Paste a free MaxMind GeoLite2 license key to enable the geographic source map. When you save the key, the app now auto-downloads the GeoLite2 City database. See [GeoIP](./geoip.md).

You can skip this; everything else works without the map.

## Step 6: Branding (optional)

White-label the app: set the app name, brand colors for light and dark mode, the default theme, and upload a logo and favicon. See [Branding](./branding.md).

You can skip this and configure it later in **Settings -> Branding**.

## Finishing

When you finish, the app is live. Mailboxes begin polling on the interval you set. Remember that aggregate DMARC reports arrive roughly once per day per reporter, so a freshly-pointed mailbox fills over about 24 hours rather than instantly.
