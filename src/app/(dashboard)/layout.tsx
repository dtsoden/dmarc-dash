import Link from "next/link";
import { Nav } from "@/components/nav";
import { requireSetupComplete, requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireSetupComplete();          // redirects to /setup if not configured
  const session = await requireUser();   // redirects to /login if not signed in
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/" className="font-semibold">DMARC Dashboard</Link>
          <Nav role={session.role!} username={session.username} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
