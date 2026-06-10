---
sidebar_position: 11
title: Deployment
---

# Deployment

DMARC Dashboard runs as a single Docker container with one mounted data volume. This page covers the volume, the encryption key, the port, and updates.

## The container and the data volume

Everything stateful lives in one `data/` volume mounted into the container:

| File                   | Purpose                                          |
| ---------------------- | ------------------------------------------------ |
| `dmarc.db`             | The SQLite database (settings, users, reports)   |
| `app.key`              | The AES key that encrypts all secrets at rest    |
| `GeoLite2-City.mmdb`   | The optional GeoIP database (see [GeoIP](./geoip.md)) |
| `brand/`               | Uploaded logo and favicon (see [Branding](./branding.md)) |

A reference `docker-compose.yml`:

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
      - ./data:/app/data
    restart: unless-stopped
```

Bring it up:

```bash
docker compose up -d --build
```

## Back up app.key

:::danger Losing app.key makes secrets unrecoverable
`app.key` is the AES key that encrypts every secret in the database (mailbox passwords, client secrets, API tokens). If you lose it, those secrets cannot be decrypted and you must re-enter them all. The app refuses to start on a corrupt or mismatched key rather than silently regenerating one. Back up the entire `data/` volume, and keep a separate copy of `app.key`.
:::

## Changing the port

The compose file maps host `9693` to container `3000`. The host side (`9693`) is just the example's free port; change it to suit your host. To change the **container** port, set the `PORT` environment variable and update the container side of the mapping to match.

```yaml
    ports:
      - "8080:3000"   # serve on host port 8080 instead
```

## Updating

To update to a new version:

```bash
docker compose pull   # or: git pull, if you build from source
docker compose up -d --build
```

Your `data/` volume is preserved across updates, so the database, encryption key, GeoIP database, and branding all carry over. Always have a current backup of `data/` (and especially `app.key`) before updating.
