---
sidebar_position: 5
title: Notifications
---

# Notifications

DMARC Dashboard sends outbound email through **MailerSend**. Notifications power three things:

- **Digest emails:** weekly and monthly summaries of DMARC activity.
- **User invites:** the single-use link a new user follows to set their own password.
- **Password resets:** the reset link sent by "forgot password".

:::warning Notifications gate user management
Adding users is **disabled until notifications are configured**, because new users are invited by email rather than given a password. The Add User form is greyed out and the API refuses the request until MailerSend is set up. See [Users and Roles](./users-and-roles.md).
:::

## Configure MailerSend

Go to **Settings -> Notifications** (or the wizard's notifications step) and enter:

- **MailerSend API token.** Create one in your MailerSend account.
- **Verified from-address.** The sender address must be a verified sender/domain in MailerSend, e.g. `dmarc@yourdomain.com`. Unverified addresses will be rejected by MailerSend.
- **Digest recipients.** The addresses that receive weekly/monthly digests.

The token is stored AES-encrypted at rest and is never returned to the browser.

## Digest schedules

DMARC Dashboard can send a **weekly** and a **monthly** digest summarizing recent DMARC
activity to the configured recipients. Each is configured under **Settings ->
Notifications**:

- Toggle each digest **on or off** independently. A digest that is off is simply not sent.
- For the weekly digest, pick the **day of the week** and the **time**.
- For the monthly digest, pick the **day of the month** (1 to 28, so it lands every month)
  and the **time**.

Click **Edit schedule** to open the picker; a plain-language summary (for example, "Every
Monday at 8:00 AM") shows exactly when it will send. No cron syntax required.

## What email is used for

| Email type       | Trigger                                  |
| ---------------- | ---------------------------------------- |
| Weekly digest    | Scheduled weekly                         |
| Monthly digest   | Scheduled monthly                        |
| User invite      | An admin adds a new user                 |
| Password reset   | A user requests "forgot password"        |

:::tip
Configure notifications early. Without it you cannot invite additional users, and no digests or reset emails will be sent.
:::
