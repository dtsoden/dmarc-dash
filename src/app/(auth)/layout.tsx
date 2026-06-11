import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/auth/guard";
import { getBrand } from "@/lib/brand";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!isSetupComplete()) redirect("/setup");
  const b = getBrand();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 px-4">
      {/* Brand header: the uploaded logo replaces the default mark, same as the sidebar. */}
      <div className="flex items-center gap-2.5">
        {b.logoExt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/api/brand/logo" alt={b.appName} className="h-10 w-auto max-w-[220px] object-contain" />
        ) : (
          <>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">{b.appName}</span>
          </>
        )}
      </div>
      {children}
    </div>
  );
}
