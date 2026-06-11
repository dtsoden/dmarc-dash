---
sidebar_position: 2
title: Getting Started
---

# Getting Started

DMARC Dashboard ships as a single Docker container. You deploy it, open it in a browser, and the first run takes you through a Setup Wizard. There are no config files of secrets to edit: everything is entered in the wizard and stored, encrypted, in the database.

## What you'll need

Before you start, have the following ready (you can also gather these during the wizard):

- A **dedicated mailbox** that receives your DMARC reports, e.g. `dmarc@yourdomain.com`. See [Choosing a Provider](./mailbox/choosing-a-provider.md).
- Your domain's DMARC record pointed (`rua=`) at that mailbox.
- Mailbox credentials:
  - **Microsoft 365:** an Entra app registration (Tenant ID, Client ID, Client Secret). See [Microsoft 365](./mailbox/microsoft-365.md).
  - **Everyone else:** an IMAP host, the full email address, and an **App Password**. See [IMAP](./mailbox/imap.md).
- Optional: a MailerSend API token (for digests and user invites), a MaxMind GeoLite2 license key (for the map), and branding assets.

## Deploy with Docker

The repository includes a `docker-compose.yml`:

```yaml
services:
  dmarc-dash:
    build: .
    ports:
      - "9693:3000"   # host:container
    environment:
      DATA_DIR: /app/data
      # PORT optional; defaults to 3000
    volumes:
      - ./data:/app/data   # holds dmarc.db, GeoLite2-City.mmdb, app.key, brand/
    restart: unless-stopped
```

Bring it up:

```bash
docker compose up -d --build
```

### Environment variables

There are only two, and neither holds a secret:

| Variable   | Purpose                                            | Default      |
| ---------- | -------------------------------------------------- | ------------ |
| `DATA_DIR` | Where the app stores its data inside the container | `/app/data`  |
| `PORT`     | Port the app listens on inside the container       | `3000`       |

All other configuration (mailbox credentials, notifications, branding, GeoIP) is entered in the Setup Wizard and saved to the database.

### Port mapping

The compose file maps host port `9693` to container port `3000`. The example uses `9693` because host `3000` was already in use on the original deployment. Change the host side of the mapping (`9693`) to whatever is free on your host. The container side should stay `3000` unless you also set `PORT`.

## First run: the Setup Wizard

Open the app in a browser, for example `http://your-host:9693/`. On first run the app redirects to the **Setup Wizard**, which:

1. Creates your first administrator account (no default credentials exist).
2. Configures your first mailbox source (domain + provider).
3. Sets the poll interval and delete mode.
4. Optionally configures notifications, GeoIP, and branding.

Walk through it in [Setup Wizard](./setup-wizard.md).

## Navigating the dashboard

On a desktop screen the full navigation lives in a sidebar on the left, and a **Documentation** link sits in the top-right of the header. On phones and narrow windows the sidebar collapses behind a hamburger button in the top-left of the header: tap it to slide out a drawer with the same navigation plus the Documentation link. The dashboard is fully usable on mobile.

## Back up your encryption key

On first run the app generates `data/app.key`, the AES key used to encrypt every secret at rest (mailbox passwords, API tokens, client secrets).

:::danger Back up `data/app.key`
If you lose `app.key`, every encrypted secret becomes unrecoverable and you will have to re-enter them all. The app refuses to start on a corrupt or mismatched key rather than silently regenerating one. Back up the whole `data/` volume, and keep a separate copy of `app.key`.
:::
