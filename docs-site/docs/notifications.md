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

Once configured, DMARC Dashboard sends:

- A **weekly** digest.
- A **monthly** digest.

These summarize recent DMARC activity for the configured recipients.

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
