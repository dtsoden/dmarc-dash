---
sidebar_position: 10
title: Polling and Safe-Delete
---

# Polling and Safe-Delete

DMARC Dashboard polls your DMARC mailboxes on a schedule, ingests genuine reports, and cleans them up safely. This page explains the poll interval, the manual "Poll now" button, and exactly what the ingester does and does not touch.

## Poll interval

- A single **global poll interval** (in minutes) applies to all mailboxes.
- Change it in **Settings**; the change is rescheduled live on save.
- Set it to `1` while testing so you don't wait for the timer.
- On each tick, every active mailbox is polled concurrently. See [Multiple Domains](./mailbox/multiple-domains.md).

:::tip Reports arrive about once a day
Aggregate DMARC reports are sent roughly once per day per reporter, so a freshly-pointed mailbox fills over about 24 hours. A short poll interval makes the app check often, but it cannot make reporters send faster.
:::

## Poll now

Administrators and analysts get a **Poll now** button so you don't have to wait for the next scheduled tick. It runs an immediate poll across the active mailboxes.

## Safe-delete behavior

The ingester is deliberately conservative. It only ever acts on an email that is a **genuine DMARC report**, identified by a report-type attachment (`.xml`, `.xml.gz`, `.gz`, or `.zip`) or a `Report Domain:` subject.

| Email                                   | What happens                                              |
| --------------------------------------- | -------------------------------------------------------- |
| Genuine DMARC report, parses cleanly    | Ingested, then **soft-deleted** (moved to Deleted Items) |
| Genuine DMARC report, fails to parse    | Moved to a **`DMARC-Errors`** folder (not deleted)       |
| Ordinary mail (anything else)           | **Left completely untouched**                            |

:::warning Why a dedicated mailbox matters
Reports are deleted (softly, recoverable for roughly 14 to 30 days) only after a successful ingest. A dedicated or shared mailbox keeps that delete activity away from real correspondence. An earlier version once moved non-report mail into `DMARC-Errors` on a real inbox; the current version never parses, moves, or deletes ordinary mail. Still, point `rua=` at a dedicated mailbox.
:::

### The DMARC-Errors folder

When a message looks like a DMARC report but cannot be parsed, it is moved to a `DMARC-Errors` folder (safe mode) rather than deleted, so you can inspect it. Nothing is permanently lost: soft-deleted reports go to Deleted Items and are recoverable for the provider's retention window.

### Non-report mail does nothing

If a message is not a genuine DMARC report, the ingester ignores it entirely. Normal emails, `.pdf` attachments, and no-attachment messages are never parsed, moved, or deleted, even in the more aggressive delete mode.
