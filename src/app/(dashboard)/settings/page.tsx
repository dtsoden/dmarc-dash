import { requireRole } from "@/lib/auth/guard";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireRole("admin");
  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 font-display text-xl font-semibold">Settings</h1>
      <SettingsForm />
    </div>
  );
}
