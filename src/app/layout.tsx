import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getBrand } from "@/lib/brand";

const display = Sora({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const sans = Plus_Jakarta_Sans({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

function brandSafe() {
  try { return getBrand(); }
  catch { return { appName: "DMARC Dashboard", primary: "#0093a2", accent: "#00df7e", logoExt: "", faviconExt: "" }; }
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
  // White-label: override brand color tokens at runtime from admin settings.
  const themeVars = `:root{--primary:${b.primary};--brand-accent:${b.accent};--ring:${b.accent};--sidebar-primary:${b.primary};}.dark{--primary:${b.accent};--ring:${b.accent};}`;
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
