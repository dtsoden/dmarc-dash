"use client";
import { useEffect, useState } from "react";
import { useDialog } from "@/components/dialog";

type Role = "admin" | "analyst" | "viewer";
interface AppUser {
  id: number; username: string; email: string; role: Role;
  isActive: boolean; mustChangePassword: boolean; lastLoginAt: number | null;
}

function relTime(epoch: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - epoch);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function UserStatus({ u }: { u: AppUser }) {
  const pill = "w-fit rounded-full px-2 py-0.5 text-xs font-medium";
  if (!u.isActive) return <span className={`${pill} bg-muted text-muted-foreground`}>Inactive</span>;
  if (!u.lastLoginAt) return <span className={`${pill} bg-amber-500/12 text-amber-600 dark:text-amber-400`}>Invite pending</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`${pill} bg-emerald-500/12 text-emerald-600 dark:text-emerald-400`}>Active</span>
      <span className="text-[11px] text-muted-foreground">last seen {relTime(u.lastLoginAt)}{u.mustChangePassword ? " · reset pending" : ""}</span>
    </div>
  );
}

const input = "rounded-md border px-2 py-1 text-sm";
const ROLES: Role[] = ["admin", "analyst", "viewer"];

export function UsersAdmin({ emailConfigured = true }: { emailConfigured?: boolean }) {
  const dialog = useDialog();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "viewer" as Role });

  async function load() {
    const r = await fetch("/api/users");
    if (r.ok) setUsers(await r.json());
    else setError("Failed to load users");
  }
  useEffect(() => { void load(); }, []);

  async function addUser() {
    setError(""); setNotice("");
    const r = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) {
      setForm({ username: "", email: "", password: "", role: "viewer" });
      if (data.invited) setNotice(`Invite email sent to ${data.email}. They set their own password via the link (valid 7 days).`);
      else if (data.tempPassword) setNotice(`User created. Email isn't configured, share this one-time password securely: ${data.tempPassword}`);
      else setNotice("User created. They'll be prompted to change the password you set on first sign-in.");
      await load();
    } else {
      setError(data.error ?? "Failed to add user");
    }
  }

  async function patch(id: number, body: Record<string, unknown>) {
    setError("");
    const r = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) await load();
    else setError((await r.json()).error ?? "Update failed");
  }

  async function remove(u: AppUser) {
    const ok = await dialog.confirm({
      title: "Delete user",
      message: <>Permanently delete <strong>{u.username}</strong> ({u.email})? This cannot be undone.</>,
      confirmLabel: "Delete", destructive: true,
    });
    if (!ok) return;
    setError("");
    const r = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (r.ok) await load();
    else setError((await r.json()).error ?? "Delete failed");
  }

  async function toggleActive(u: AppUser) {
    if (u.isActive) {
      const ok = await dialog.confirm({
        title: "Deactivate user",
        message: <>Deactivate <strong>{u.username}</strong>? They will not be able to sign in until reactivated.</>,
        confirmLabel: "Deactivate", destructive: true,
      });
      if (!ok) return;
    }
    await patch(u.id, { isActive: !u.isActive });
  }

  async function resetPassword(u: AppUser) {
    const pw = await dialog.prompt({
      title: "Reset password",
      message: <>Set a new temporary password for <strong>{u.username}</strong>. They will be prompted to change it on next sign-in.</>,
      label: "New password", type: "password", placeholder: "Min 8 characters", confirmLabel: "Set password",
      validate: (v) => (v.length < 8 ? "Password must be at least 8 characters." : null),
    });
    if (pw === null) return;
    await patch(u.id, { password: pw });
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {notice && <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

      <section className="card-elev space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display font-medium">Add user</h2>
        <p className="text-xs text-muted-foreground">The new user is emailed a single-use link (valid 7 days) to set their own password. No password is sent by email.</p>
        <fieldset disabled={!emailConfigured} className="flex flex-wrap items-end gap-2 disabled:opacity-50">
          <input className={input} placeholder="Username" value={form.username}
            onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))} />
          <input className={input} placeholder="Email" value={form.email}
            onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          <select className={input} value={form.role}
            onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as Role }))}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="button" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60" onClick={addUser} disabled={!emailConfigured}>Send invite</button>
        </fieldset>
      </section>

      <div className="card-elev overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2.5 font-medium">Username</th>
              <th className="px-3 py-2.5 font-medium">Email</th>
              <th className="px-3 py-2.5 font-medium">Role</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5 font-medium">{u.username}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{u.email}</td>
                <td className="px-3 py-2.5">
                  <select className={input} value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2.5"><UserStatus u={u} /></td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                      onClick={() => toggleActive(u)}>
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                      onClick={() => resetPassword(u)}>Reset password</button>
                    <button type="button" className="rounded-md border border-destructive/50 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => remove(u)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
