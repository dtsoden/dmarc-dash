// @ts-check
import { themes as prismThemes } from "prism-react-renderer";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "DMARC Dashboard",
  tagline: "Self-hosted DMARC aggregate report monitoring",
  favicon: "img/logo.svg",

  url: "https://dmarc.local",
  baseUrl: "/docs/",
  trailingSlash: true,

  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",

  i18n: { defaultLocale: "en", locales: ["en"] },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: "/",            // docs are the site root (served at /docs/)
          sidebarPath: "./sidebars.js",
        },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: { defaultMode: "dark", respectPrefersColorScheme: true },
      navbar: {
        title: "DMARC Dashboard",
        logo: { alt: "DMARC Dashboard", src: "img/logo.svg" },
        items: [{ type: "docSidebar", sidebarId: "docs", position: "left", label: "Documentation" }],
      },
      footer: {
        style: "dark",
        copyright: "DMARC Dashboard documentation.",
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ["powershell", "bash", "json"],
      },
    }),
};

export default config;
