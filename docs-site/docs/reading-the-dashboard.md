---
sidebar_position: 4
title: Reading the Dashboard
---

# Reading the Dashboard

These are the monitoring views. Each one answers a different question about the mail being
sent under your domains. They are read-only: the data comes from the DMARC aggregate
reports the dashboard ingests, filtered by the domain and date range you pick at the top of
each page.

## Overview

The starting point. A row of headline numbers (total messages, DMARC / SPF / DKIM pass
rates, quarantined, rejected, and how many distinct sources are sending) over a
volume-by-day chart of passing versus failing mail.

Use it for a quick health check: is the bulk of your mail authenticating, and is the volume
what you expect? A sudden drop in pass rate, or a spike from new sources, is your cue to dig
into the other views.

## Authentication

How your mail aligned for SPF and DKIM across the selected range. DMARC passes when a
message aligns on SPF or DKIM, so this view shows where that alignment is coming from and
where it is missing.

Use it to find legitimate senders that are not set up correctly yet, for example a service
sending on your behalf that fails DKIM, so you can fix their configuration before you
tighten your policy.

## Policy

The disposition breakdown: what receiving servers actually did with your mail (delivered,
quarantined, or rejected) under your published DMARC policy.

Use it to judge the impact of your policy. At `p=none` everything is delivered and this
reports what *would* happen; as you move to `quarantine` or `reject`, it shows how much mail
is being acted on, so you can tighten up without blocking real senders.

## Reports

The raw material: every DMARC aggregate report ingested, one row per report, searchable and
sortable by reporter, domain, date range, and message count. Open a report to see its
per-source detail, the sending IPs, their volumes, and their SPF / DKIM / DMARC results.

Use it when you need to trace a specific result back to its source: which reporter sent it,
which IP was responsible, and exactly how it authenticated.
