import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  if (isSetupComplete()) redirect("/");
  return <div className="min-h-screen bg-muted/30">{children}</div>;
}
