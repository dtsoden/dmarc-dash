import { requireRole } from "@/lib/auth/guard";
import { UsersAdmin } from "@/components/users-admin";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireRole("admin");
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Users</h1>
      <UsersAdmin />
    </div>
  );
}
