import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!isSetupComplete()) redirect("/setup");
  return <div className="flex min-h-screen items-center justify-center bg-muted/30">{children}</div>;
}
