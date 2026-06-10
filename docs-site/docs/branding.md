---
sidebar_position: 7
title: Branding
---

# Branding

DMARC Dashboard is white-label. You can rebrand the entire app: its name, colors, default theme, logo, and favicon. Branding is configured in **Settings -> Branding** and in the wizard's branding step.

## What you can customize

- **App name.** Replaces "DMARC Dashboard" throughout the UI.
- **Brand color (per mode).** Separate colors for **light** and **dark** mode. The brand color drives buttons, active tabs, links, the focus ring, and the logo mark. Button and logo text auto-contrasts by luminance, so it stays readable on light or dark brand colors.
- **Default theme.** Light or dark, the default the app loads in. A user's own light/dark toggle overrides this per browser.
- **Logo.** Uploaded and shown in the app.
- **Favicon.** Uploaded and used as the browser tab icon.

## How it works

Brand settings are injected as CSS variables in the root layout at runtime, so changes apply immediately. Uploaded logo and favicon files are stored in the `data/` volume (under `brand/`) and served by the app.

:::tip
Set the light-mode and dark-mode brand colors independently. A color that looks great on a light background can be hard to read on a dark one, so tune each mode.
:::

## Where to configure

- **Setup Wizard:** the optional branding step during first-run setup.
- **Settings -> Branding:** any time after setup.

Because logo and favicon files live in the `data/` volume, your branding survives container restarts and updates as long as the volume is preserved. See [Deployment](./deployment.md).
