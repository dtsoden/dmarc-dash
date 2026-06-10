---
sidebar_position: 6
title: Users and Roles
---

# Users and Roles

DMARC Dashboard supports multiple users with three roles. There is no self-registration: an administrator adds users, and each new user sets their own password from an emailed invite link.

## The three roles

| Role            | Can do                                                                 |
| --------------- | --------------------------------------------------------------------- |
| **Administrator** | Everything: manage users, mailboxes, notifications, branding, GeoIP, and all settings. |
| **Analyst**     | View dashboards, run a manual poll ("Poll now"), and export data.      |
| **Viewer**      | Read-only access to dashboards and reports.                           |

:::info The last administrator is protected
The final remaining administrator cannot be deleted, demoted, or deactivated, so you can never lock yourself out.
:::

## Inviting users

Adding users requires notifications (MailerSend) to be configured. See [Notifications](./notifications.md).

1. Go to the **Users** area.
2. Enter the user's username and email, and choose a role.
3. The user receives a **single-use invite link** that is valid for **7 days**.
4. They follow the link and set their own password.

:::tip No passwords are ever emailed
New users always set their own password from the invite link. DMARC Dashboard never sends a password by email, neither for invites nor for resets.
:::

## Status indicator

Each user shows a status:

- **Invite pending:** invited but has not yet set a password.
- **Active:** has set a password and can sign in, shown with a last-seen time.

## Forgot password

A user who has lost their password uses **forgot password** on the sign-in screen. DMARC Dashboard emails them a reset link (again via MailerSend). No password is emailed; they set a new one from the link.

## Change password

A signed-in user can change their own password from their account settings.
