# Site Style Guide

Canonical color palette for the DMARC Dashboard. All UI, shadcn components, and custom CSS MUST reference these tokens. Applied selectively (tokens + a few semantic accents), not as a heavy reskin.

## Palette

| Role             | Hex      | CSS Variable      |
|------------------|----------|-------------------|
| PRIMARY          | #0093a2  | --color-primary   |
| Secondary        | #006c88  | --color-secondary |
| Main Accent      | #00df7e  | --color-accent    |
| Secondary Accent | #00baa0  | --color-accent-2  |
| Third Accent     | #2eff36  | --color-accent-3  |
| Neutral (dark)   | #2f4858  | --color-ink       |

The full source ramp (green -> slate) is also used for chart series:
`#2eff36`, `#00df7e`, `#00baa0`, `#0093a2`, `#006c88`, `#2f4858`.

## Usage rules

- **PRIMARY (#0093a2)**: primary buttons, active nav item, links, the wordmark. The dominant brand color.
- **Secondary (#006c88)**: deeper supporting surfaces, secondary emphasis.
- **Main Accent (#00df7e)**: positive/"pass" semantics (DMARC/SPF/DKIM pass), success highlights, chart "pass" series.
- **Secondary Accent (#00baa0)**: focus rings, hover states, chart-2.
- **Third Accent (#2eff36)**: reserve for a single high-energy highlight (e.g. a "live" pulse). Do not use for large fills, it is harsh at scale.
- **Neutral (#2f4858)**: body text color in light mode; base surface in dark mode.
- **Failure semantics stay red** (`--destructive`), green/red pass/fail contrast is intentional and must not be recolored to two greens.

## CSS tokens

```css
:root {
  --color-primary:  #0093a2;
  --color-secondary:#006c88;
  --color-accent:   #00df7e;
  --color-accent-2: #00baa0;
  --color-accent-3: #2eff36;
  --color-ink:      #2f4858;
}
```

## shadcn token mapping (in src/app/globals.css)

- `--primary` -> #0093a2 (foreground white)
- `--ring`, `--sidebar-ring` -> #00baa0
- `--accent` -> light tint of #00baa0 (subtle hover surface), `--accent-foreground` -> #0093a2
- `--foreground` -> #2f4858 (softened ink)
- `--chart-1..5` -> #00df7e, #00baa0, #0093a2, #006c88, #2f4858
- dark mode `--background`/`--card`/`--sidebar` derived from #2f4858; dark `--primary` -> #00df7e for contrast

## Brand assets

No logo/favicon supplied yet. Placeholder: the text wordmark "DMARC Dashboard" rendered in PRIMARY. Drop real assets into `style-guide/brand-assets/` later and wire them in.

## Enforcement

Before generating or editing any UI:
1. Re-read this file.
2. Use only these colors (or computed shades) for visual elements.
3. Keep pass = brand green, fail = red. Do not introduce new hues without updating this file.
4. Use the shadcn MCP to add components, then bind them to these tokens.
