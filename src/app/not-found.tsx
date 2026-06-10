import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-16">
      {/* The graphic carries its own messaging, just show it large and legible. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/404.png" alt="Page not found" loading="lazy" decoding="async" className="w-full max-w-3xl" />
      <Link href="/" className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
        Back to dashboard
      </Link>
    </div>
  );
}
