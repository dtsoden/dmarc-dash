import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getBrand, readableText } from "@/lib/brand";

const display = Sora({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const sans = Plus_Jakarta_Sans({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

function brandSafe() {
  try { return getBrand(); }
  catch { return { appName: "DMARC Dashboard", colorLight: "#0093a2", colorDark: "#00df7e", logoExt: "", faviconExt: "" }; }
}

export async function generateMetadata(): Promise<Metadata> {
  const b = brandSafe();
  return {
    title: { default: b.appName, template: `%s · ${b.appName}` },
    description: `${b.appName} — DMARC aggregate report monitoring`,
    icons: b.faviconExt ? { icon: "/api/brand/favicon" } : undefined, // else app/icon.svg is used
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const b = brandSafe();
  const fgL = readableText(b.colorLight);
  const fgD = readableText(b.colorDark);
  // White-label: one brand color per mode drives buttons, active tabs, links, ring, and
  // the logo. Foreground auto-contrasts so bright colors stay readable.
  const themeVars =
    `:root{--primary:${b.colorLight};--primary-foreground:${fgL};--ring:${b.colorLight};--brand-accent:${b.colorLight};--sidebar-primary:${b.colorLight};--sidebar-primary-foreground:${fgL};}` +
    `.dark{--primary:${b.colorDark};--primary-foreground:${fgD};--ring:${b.colorDark};--brand-accent:${b.colorDark};--sidebar-primary:${b.colorDark};--sidebar-primary-foreground:${fgD};}`;
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeVars }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();` }} />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground">{children}</body>
    </html>
  );
}
