---
sidebar_position: 12
title: Backup and Restore
---

# Backup and Restore

Everything that makes this dashboard *this* dashboard lives in one data folder: the
database, the encryption key, the GeoIP database, and your branding assets. Backup
downloads that whole folder as a single zip, and Restore unpacks it back, so you can move
or clone the instance to any other host and have it come up identical.

Both live under **Settings -> Backup**, as the **Backup** and **Restore** sub-tabs. Only
administrators can see them.

## What is in a backup

A backup zip contains the complete contents of the data volume:

| Item                 | Why it matters                                                   |
| -------------------- | --------------------------------------------------------------- |
| `dmarc.db`           | All settings, users, monitored domains, and ingested reports    |
| `app.key`            | The AES key that decrypts every stored secret                   |
| `GeoLite2-City.mmdb` | The optional GeoIP database, if you configured one              |
| `brand/`             | Your uploaded logo and favicon                                  |

Because the encryption key (`app.key`) travels in the same archive as the encrypted
mailbox credentials, the backup is self-consistent: restored anywhere, the secrets
decrypt correctly with no extra steps.

:::warning Keep backups private
The archive contains your encryption key and the encrypted mailbox credentials. Anyone
holding it can read your stored secrets. Treat a backup like a password and store it
somewhere private.
:::

## Creating a backup

1. Go to **Settings -> Backup -> Backup**.
2. Click **Download backup**.
3. A file named `dmarc-backup-<timestamp>.zip` downloads to your machine.

The database is captured as a consistent point-in-time snapshot, so it is safe to take a
backup while the dashboard is running and polling.

## Restoring a backup

Restore **overwrites the entire data volume** of the instance you run it on, then restarts
the container. Anything in that instance that is not in the backup is lost, and afterward
you sign in with the credentials from the backup.

1. Go to **Settings -> Backup -> Restore**.
2. Click **Choose backup file** and select a `dmarc-backup-*.zip`.
3. Click **Restore and restart**, then confirm.
4. The dashboard writes the files, restarts, and sends you to the login screen. Sign in
   with the admin account from the backup.

The restart is how the restored database, encryption key, and settings are reloaded
cleanly. It relies on the container restart policy (`restart: unless-stopped` in the
provided `docker-compose.yml`), which is the default, so the container comes back on its
own within a few seconds.

## Cloning onto a fresh instance

This is the main reason the key ships inside the backup: stand up a brand-new, empty
instance and restore straight into it.

1. Start a fresh container with an empty data volume (a new Docker host, Easypanel, or
   anywhere else). It will show the **setup wizard** because no admin exists yet.
2. On the wizard's first screen, choose **Restore from a backup** instead of **Set up a
   new system**.
3. Upload your backup zip and confirm.
4. The instance restarts as an exact copy of the original, same login, same monitored
   domains, same history.

You do not need to complete the wizard first. Restore is available on a blank instance
precisely so a fresh deployment can become a clone in one step.

## Moving to a new server, end to end

1. On the old instance: **Settings -> Backup -> Backup -> Download backup**.
2. Deploy the dashboard on the new server with an empty data volume.
3. On the new instance's setup wizard, choose **Restore from a backup** and upload the zip.
4. After it restarts, sign in. Point your DMARC `rua` DNS records and mailbox at the new
   instance if anything about the hostname changed.
5. Decommission the old instance once you have confirmed the new one is healthy.

## Notes and limits

- Restore replaces everything. There is no selective or partial restore.
- A zip that does not contain `dmarc.db` is rejected, so an unrelated file cannot wipe
  your data by mistake.
- The session cookie is tied to the encryption key. Because restore replaces `app.key`,
  any existing sessions become invalid and everyone must sign in again.
- Keep at least one recent backup off the server itself. If you lose the data volume and
  have no backup, the encrypted secrets cannot be recovered.
