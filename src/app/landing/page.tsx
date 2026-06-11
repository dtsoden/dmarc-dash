import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Mail, ShieldCheck, Globe2, Network, MapPin, Send, Palette, DatabaseBackup,
  ArrowRight, BookOpen, Lock, KeyRound, ShieldX, MailWarning, EyeOff,
} from "lucide-react";
import { getBrand } from "@/lib/brand";
import pkg from "../../../package.json";

// Public marketing page, served at "/" for anonymous visitors when LANDING=1 (see
// src/proxy.ts). Must be dynamic: the env check happens per request, so an instance
// built without LANDING set still serves the page once the variable is provided.
export const dynamic = "force-dynamic";

const ACCENT = "#00df7e";
const TEAL = "#0093a2";
const REPO = "https://github.com/dtsoden/dmarc-dash";
// Always resolves to the newest published release, so download links never go stale.
const DOWNLOAD = `${REPO}/releases/latest`;
const VERSION = `v${pkg.version}`;

function GitHubMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

const FEATURES = [
  { icon: Mail, title: "Mailbox monitoring", body: "Connect Microsoft 365 with app-only Graph, or any IMAP mailbox. Reports are pulled, parsed, and filed automatically on your schedule." },
  { icon: ShieldCheck, title: "Safe by design", body: "Only genuine DMARC reports are ever touched. Ordinary mail is never parsed, moved, or deleted. Unparseable reports are set aside, not lost." },
  { icon: Globe2, title: "Every domain, one place", body: "Monitor as many domains as you like, each with its own mailbox and provider, all polled concurrently on one interval." },
  { icon: Network, title: "DNS authentication report", body: "Read-only checks for SPF, DMARC, DKIM, MX, BIMI, MTA-STS, and TLS-RPT, with DKIM selectors discovered from your own reports." },
  { icon: MapPin, title: "See where mail comes from", body: "An interactive world map of sending IPs, sized by volume and colored by pass rate, powered by a free GeoLite2 key." },
  { icon: Send, title: "Digests that come to you", body: "Weekly and monthly email summaries on a schedule you pick with plain day-and-time controls. No cron syntax anywhere." },
  { icon: Palette, title: "Make it yours", body: "White-label the whole dashboard: brand colors per mode, your logo and favicon, your product name, your default theme." },
  { icon: DatabaseBackup, title: "Leave anytime", body: "One click downloads the entire data volume, encryption key included. Restore it into any fresh instance for an exact clone." },
];

const STEPS = [
  { n: "01", title: "Point your DMARC record", body: "Set the rua= address in your DMARC DNS record to a dedicated mailbox. Receivers start sending aggregate reports there within a day." },
  { n: "02", title: "Connect the mailbox", body: "The setup wizard walks you through Microsoft 365 or IMAP. Credentials are encrypted at rest with a key that never leaves your server." },
  { n: "03", title: "Read the answers", body: "Pass rates, failing sources, policy impact, geography, and digests in your inbox. The XML noise becomes a clear picture." },
];

// Static bar heights for the hero's mock chart; the last value in a pair > 0 renders
// a red "fail" cap on top of the green bar.
const BARS: Array<[number, number]> = [
  [38, 0], [52, 6], [44, 0], [61, 0], [47, 8], [70, 0],
  [58, 0], [82, 10], [66, 0], [74, 0], [88, 6], [79, 0],
];

export default function LandingPage() {
  if (process.env.LANDING !== "1") notFound();
  // Same fallback as the root layout: the public page must render even if the
  // database is fresh or unreadable.
  let b;
  try { b = getBrand(); }
  catch { b = { appName: "DMARC Dashboard", colorLight: "#0093a2", colorDark: "#00df7e", defaultTheme: "dark", logoExt: "", faviconExt: "" }; }

  return (
    <div className="min-h-screen bg-[#070d16] font-sans text-[#e6edf6] [color-scheme:dark]">
      {/* Anchor links scroll smoothly while this page is mounted. */}
      <style>{`html{scroll-behavior:smooth}`}</style>

      {/* ===== Nav ===== */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#070d16]/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <div className="flex items-center gap-2.5">
            {b.logoExt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/api/brand/logo" alt={b.appName} className="h-8 w-auto max-w-[160px] object-contain" />
            ) : (
              <>
                <span className="grid h-9 w-9 place-items-center rounded-xl shadow-sm" style={{ background: ACCENT }}>
                  <ShieldCheck className="h-5 w-5 text-[#0b1a14]" />
                </span>
                <span className="font-display text-[15px] font-bold tracking-tight">{b.appName}</span>
              </>
            )}
          </div>
          <div className="ml-auto hidden items-center gap-6 text-sm text-[#8b98ab] md:flex">
            <a href="#problem" className="transition-colors hover:text-white">The problem</a>
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#how" className="transition-colors hover:text-white">How it works</a>
            <a href="/docs" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Docs</a>
            <a href={REPO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
              <GitHubMark /> GitHub
            </a>
          </div>
          <Link href="/login"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-[#0b1a14] transition-opacity hover:opacity-90 md:ml-0"
            style={{ background: ACCENT }}>
            Log in <ArrowRight className="size-4" />
          </Link>
        </nav>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        {/* Glows + grid backdrop */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.13] blur-3xl"
            style={{ background: `radial-gradient(closest-side, ${ACCENT}, transparent)` }} />
          <div className="absolute -right-40 top-40 h-[380px] w-[520px] rounded-full opacity-[0.10] blur-3xl"
            style={{ background: `radial-gradient(closest-side, ${TEAL}, transparent)` }} />
          <div className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
            }} />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 md:grid-cols-2 md:pb-28 md:pt-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-[#8b98ab]">
              <Lock className="size-3.5" style={{ color: ACCENT }} /> Self-hosted. Your reports never leave your server.
            </p>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] tracking-tight md:text-[3.4rem]">
              Know exactly who sends as{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${ACCENT}, ${TEAL})` }}>
                your domain
              </span>
              .
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#8b98ab]">
              {b.appName} reads the reports mail providers already send about your domain and
              turns them into plain answers: who is sending as your brand, which messages reach
              customers, and what is quietly disappearing into spam.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/login"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-[#0b1a14] shadow-lg transition-opacity hover:opacity-90"
                style={{ background: ACCENT, boxShadow: `0 8px 32px -8px ${ACCENT}66` }}>
                Log in to your dashboard <ArrowRight className="size-4" />
              </Link>
              <a href={DOWNLOAD} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-6 py-3 text-sm font-medium text-[#e6edf6] transition-colors hover:bg-white/[0.05]">
                <GitHubMark /> Download {VERSION}
              </a>
              <a href="/docs" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-[#8b98ab] transition-colors hover:text-white">
                <BookOpen className="size-4" /> Read the docs
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#8b98ab]">
              <span className="inline-flex items-center gap-2"><KeyRound className="size-4" style={{ color: ACCENT }} /> Secrets encrypted at rest</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4" style={{ color: ACCENT }} /> One Docker container</span>
            </div>
          </div>

          {/* Mock dashboard panel */}
          <div className="relative">
            <div className="card-elev rounded-2xl border border-white/[0.08] bg-[#0d1622] p-5 shadow-2xl"
              style={{ boxShadow: `0 24px 80px -24px ${ACCENT}33, 0 24px 64px -32px rgba(0,0,0,.8)` }}>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 font-mono text-[11px] text-[#8b98ab]">dmarc.yourdomain.com</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { label: "Messages", value: "48.2k", color: "#e6edf6" },
                  { label: "DMARC pass", value: "97.4%", color: ACCENT },
                  { label: "Rejected", value: "412", color: "#ff6b6b" },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-[#8b98ab]">{kpi.label}</div>
                    <div className="mt-1 font-display text-xl font-bold tabular-nums" style={{ color: kpi.color }}>{kpi.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[#8b98ab]">Volume by day</div>
                <div className="flex h-28 items-end gap-1.5">
                  {BARS.map(([pass, fail], i) => (
                    <div key={i} className="flex flex-1 flex-col justify-end gap-px">
                      {fail > 0 && <div className="rounded-t-sm bg-[#ff6b6b]/80" style={{ height: `${fail}%` }} />}
                      <div className={fail > 0 ? "" : "rounded-t-sm"} style={{ height: `${pass}%`, background: `linear-gradient(180deg, ${ACCENT}cc, ${TEAL}99)` }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <span className="inline-flex items-center gap-2 text-xs text-[#8b98ab]">
                  <MapPin className="size-3.5" style={{ color: ACCENT }} /> 14 sending sources across 9 countries
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-[#0b1a14]" style={{ background: ACCENT }}>LIVE</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== The problem ===== */}
      <section id="problem" className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 md:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>The problem</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-4xl">
            Bad things happen to email quietly.
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-[#8b98ab]">
            No alarm goes off when your domain gets abused or your messages stop landing.
            You find out from the fallout.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-red-400/20 bg-red-400/10 text-red-400">
                <ShieldX className="size-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">Criminals send email as you</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#8b98ab]">
                Fake invoices and phishing go out under your name. Your customers cannot tell
                the difference, and every one that lands burns trust you spent years building.
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-400">
                <MailWarning className="size-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">Your real mail lands in spam</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#8b98ab]">
                Gmail and Microsoft grade every message you send. Fail their checks and your
                quotes, invoices, and campaigns vanish into junk folders. No bounce, no warning.
                Sales just hears silence.
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04]" style={{ color: TEAL }}>
                <EyeOff className="size-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">The evidence goes unread</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#8b98ab]">
                Mailbox providers send your company reports every day naming exactly who is
                sending as your domain. Almost nobody reads them, because they arrive as files
                built for machines, not people.
              </p>
            </div>
          </div>

          <p className="mt-10 max-w-2xl text-lg leading-relaxed text-[#e6edf6]">
            {b.appName} reads those reports for you, so the first time you hear about a problem
            is not from a customer.{" "}
            <a href="#features" className="inline-flex items-center gap-1 font-medium transition-opacity hover:opacity-80" style={{ color: ACCENT }}>
              See what you get <ArrowRight className="size-4" />
            </a>
          </p>
        </div>
      </section>

      {/* ===== Stats strip ===== */}
      <section className="border-y border-white/[0.06] bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 text-center md:grid-cols-4">
          {[
            ["1", "container to deploy"],
            ["2", "mailbox providers"],
            ["7", "DNS checks per domain"],
            ["0", "raw XML you will read"],
          ].map(([n, label]) => (
            <div key={label}>
              <div className="font-display text-3xl font-bold" style={{ color: ACCENT }}>{n}</div>
              <div className="mt-1 text-sm text-[#8b98ab]">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Features ===== */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 md:py-28">
        <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          Everything DMARC, <span style={{ color: ACCENT }}>nothing else</span>.
        </h2>
        <p className="mt-3 max-w-2xl text-[#8b98ab]">
          Purpose-built for one job: making your aggregate reports useful. No agents, no per-message
          fees, no third party reading your mail flow.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title}
                className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] transition-colors"
                  style={{ color: ACCENT }}>
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-display text-[15px] font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#8b98ab]">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section id="how" className="border-t border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 md:py-28">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Running in an afternoon.
          </h2>
          <p className="mt-3 max-w-2xl text-[#8b98ab]">
            One container, one data volume, a guided wizard. The reports are already being sent to
            you; this just catches them.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-white/[0.07] bg-[#0d1622] p-6">
                <span className="font-display text-4xl font-bold tracking-tight text-white/[0.08]">{s.n}</span>
                <h3 className="mt-3 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#8b98ab]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA band ===== */}
      <section className="relative overflow-hidden border-t border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{ background: `radial-gradient(ellipse 60% 90% at 50% 100%, ${ACCENT}, transparent)` }} />
        <div className="relative mx-auto max-w-3xl px-5 py-20 text-center md:py-24">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Your reports are already in the mailbox.
          </h2>
          <p className="mt-3 text-lg text-[#8b98ab]">Start reading them.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href={DOWNLOAD} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold text-[#0b1a14] transition-opacity hover:opacity-90"
              style={{ background: ACCENT, boxShadow: `0 8px 32px -8px ${ACCENT}66` }}>
              <GitHubMark /> Download {VERSION}
            </a>
            <Link href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-7 py-3.5 text-sm font-medium transition-colors hover:bg-white/[0.05]">
              Log in <ArrowRight className="size-4" />
            </Link>
            <a href="/docs/getting-started" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3.5 text-sm font-medium text-[#8b98ab] transition-colors hover:text-white">
              Getting started guide
            </a>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-[#8b98ab] md:flex-row">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4" style={{ color: ACCENT }} /> {b.appName}, self-hosted DMARC monitoring.
          </span>
          <div className="flex items-center gap-6">
            <a href="/docs" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Documentation</a>
            <a href={REPO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 transition-colors hover:text-white"><GitHubMark /> GitHub</a>
            <a href={DOWNLOAD} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Download {VERSION}</a>
            <Link href="/login" className="transition-colors hover:text-white">Log in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
