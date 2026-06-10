import Link from "next/link";

export default function NotFound() {
  // Pure black backdrop so the artwork blends seamlessly and the only thing that
  // pops is the green "Back to dashboard" button. The image scales proportionally
  // to fill the viewport (object-contain keeps its aspect ratio) while leaving
  // room for the button below.
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 overflow-hidden bg-black px-6 py-8">
      {/* The graphic carries its own messaging, just show it as large as it fits. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/404.png"
        alt="Page not found"
        loading="lazy"
        decoding="async"
        className="min-h-0 w-auto max-w-full flex-1 object-contain"
      />
      <Link
        href="/"
        className="shrink-0 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
