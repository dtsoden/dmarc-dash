---
sidebar_position: 8
title: GeoIP Map
---

# GeoIP Map

DMARC Dashboard can plot the geographic origin of the sending IP addresses in your DMARC reports on a source map. This is **optional**: every other feature works without it. The map needs a GeoIP database, which comes from MaxMind's free **GeoLite2** tier.

:::info GeoLite2 is free
The wording "license key" sounds commercial, but **GeoLite2 is MaxMind's free tier**. You only need a free MaxMind account. (GeoIP2 is the paid product and is not used.)
:::

## Get a free MaxMind license key

1. Sign up for a free account at MaxMind (maxmind.com).
2. After confirming your account, go to your account's license keys page.
3. Generate a **license key** and copy it.

:::warning MaxMind outages can block signup
MaxMind's account signup, password reset, and confirmation emails depend on their service being up. If you "can't get the confirmation email," check MaxMind's status page: an outage on their side, not your account, is the usual cause. Try again later.
:::

## Enable the map

1. Go to **Settings -> GeoIP** (or the wizard's GeoIP step).
2. Paste the license key and save.
3. Saving the key now **auto-downloads** the GeoLite2 City database into the `data/` volume.

Once the database is present, the source map renders. Until then, the rest of the app works normally and the map simply does not display.

:::tip
The database lives in the `data/` volume as `GeoLite2-City.mmdb`. It is preserved across restarts and updates as long as the volume is preserved. See [Deployment](./deployment.md).
:::
