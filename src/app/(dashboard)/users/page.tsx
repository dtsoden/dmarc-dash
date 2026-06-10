import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getSetting } from "@/lib/settings";
import { UsersAdmin } from "@/components/users-admin";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireRole("admin");
  const emailConfigured = !!getSetting<string>("mailersend_token");
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">Users</h1>
      {!emailConfigured && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Adding users is disabled until outbound email is configured, new users are invited by email to set their own password.
          Configure it under <Link href="/settings" className="font-medium underline">Settings &rarr; Notifications</Link>.
        </p>
      )}
      <UsersAdmin emailConfigured={emailConfigured} />
    </div>
  );
}
