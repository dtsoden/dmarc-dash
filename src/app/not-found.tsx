import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/404.png" alt="Page not found" loading="lazy" decoding="async" className="w-full max-w-md" />
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="text-sm text-muted-foreground">The page you are looking for does not exist or has moved.</p>
      </div>
      <Link href="/" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        Back to dashboard
      </Link>
    </div>
  );
}
