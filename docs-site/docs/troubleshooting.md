---
sidebar_position: 12
title: Troubleshooting
---

# Troubleshooting

Common issues and how to resolve them.

## IMAP "Command failed" against a Microsoft 365 mailbox

**Symptom:** an IMAP connection to a Microsoft 365 / Exchange Online mailbox fails with "Command failed" or an authentication error, even with what you believe is the right password.

**Cause:** Microsoft has disabled Basic Auth IMAP tenant-wide and offers no app passwords for Exchange Online IMAP. The IMAP path cannot work for Microsoft 365.

**Fix:** use the **Microsoft Graph** provider instead. See [Microsoft 365](./mailbox/microsoft-365.md) and [Choosing a Provider](./mailbox/choosing-a-provider.md).

## Graph "Access is denied. Check credentials and try again."

**Symptom:** the Microsoft 365 connection test fails with "Access is denied," even though your Tenant ID, Client ID, and Secret are correct.

**Cause:** the token was issued (credentials are right), but the app is not authorized to read the mailbox. The message is misleading.

**Fix, in order:**

1. **Grant admin consent.** In the app registration's **API permissions**, confirm `Mail.ReadWrite` shows a green "Granted" status. Click **Grant admin consent** if it does not.
2. **Wait for propagation.** If you just granted consent, wait 5 to 15 minutes and retry.
3. **Check the mailbox.** Confirm the mailbox UPN is a real, licensed Exchange mailbox (or a shared mailbox) and is spelled correctly.

Full detail in [Microsoft 365 -> Troubleshooting](./mailbox/microsoft-365.md#troubleshooting).

## IMAP rejects the password (non-Microsoft)

**Symptom:** Gmail / Google Workspace / Fastmail IMAP rejects your password.

**Cause:** you are using the account's normal password. Modern IMAP providers require an **App Password**.

**Fix:** enable 2-Step Verification (for Google) and generate an App Password, then use that. See [IMAP](./mailbox/imap.md).

## No map on the dashboard

**Symptom:** the geographic source map does not render.

**Cause:** the GeoIP database is missing or the MaxMind key is not set. GeoIP is optional.

**Fix:** add a free MaxMind GeoLite2 license key in **Settings -> GeoIP**; saving it auto-downloads the database. If account signup or email is failing, suspect a MaxMind outage rather than your account. See [GeoIP](./geoip.md).

## Invites not sending / can't add users

**Symptom:** the Add User form is greyed out, or invite emails never arrive.

**Cause:** adding users requires outbound email, and notifications (MailerSend) are not configured.

**Fix:** configure **Settings -> Notifications** with a MailerSend token and a verified from-address. New users then receive a single-use, 7-day invite link. See [Notifications](./notifications.md) and [Users and Roles](./users-and-roles.md).

## Empty dashboards / no reports

**Symptom:** the dashboards are empty after setup.

**Causes and fixes:**

- **No reports yet.** Aggregate DMARC reports arrive roughly once per day per reporter, so a freshly-pointed mailbox fills over about 24 hours. Give it time.
- **`rua=` not pointed at this mailbox.** Confirm the domain's DMARC record `rua=` actually points at the mailbox you connected. Use the [DNS Report](./dns-report.md) to inspect the live DMARC record.
- **Mailbox not receiving external mail.** Confirm reports are actually landing in the mailbox (check it directly).
- **Connection failing.** Check the per-mailbox status in **Settings -> Mailbox Monitoring** for the last poll result and error detail.
