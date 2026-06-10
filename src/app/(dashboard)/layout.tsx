import { requireSetupComplete, requireUser } from "@/lib/auth/guard";
import { getBrand } from "@/lib/brand";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireSetupComplete();          // redirects to /setup if not configured
  const session = await requireUser();   // redirects to /login if not signed in
  const brand = getBrand();
  return (
    <div className="flex min-h-screen">
      <AppSidebar role={session.role!} username={session.username} appName={brand.appName} logoExt={brand.logoExt} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader role={session.role!} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-7">{children}</main>
      </div>
    </div>
  );
}
