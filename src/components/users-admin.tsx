"use client";
import { useEffect, useState } from "react";

type Role = "admin" | "analyst" | "viewer";
interface AppUser {
  id: number; username: string; email: string; role: Role;
  isActive: boolean; mustChangePassword: boolean;
}

const input = "rounded-md border px-2 py-1 text-sm";
const ROLES: Role[] = ["admin", "analyst", "viewer"];

export function UsersAdmin({ emailConfigured = true }: { emailConfigured?: boolean }) {
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

  async function remove(id: number) {
    setError("");
    const r = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (r.ok) await load();
    else setError((await r.json()).error ?? "Delete failed");
  }

  async function resetPassword(id: number) {
    const pw = window.prompt("New temporary password (min 8 characters)");
    if (!pw) return;
    if (pw.length < 8) { setError("Password too short"); return; }
    await patch(id, { password: pw });
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

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Must change</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-3 py-2">{u.username}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">
                  <select className={input} value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">{u.isActive ? "Yes" : "No"}</td>
                <td className="px-3 py-2">{u.mustChangePassword ? "Yes" : "No"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded-md border px-2 py-1 text-xs"
                      onClick={() => patch(u.id, { isActive: !u.isActive })}>
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" className="rounded-md border px-2 py-1 text-xs"
                      onClick={() => resetPassword(u.id)}>Reset password</button>
                    <button type="button" className="rounded-md border border-destructive px-2 py-1 text-xs text-destructive"
                      onClick={() => remove(u.id)}>Delete</button>
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
