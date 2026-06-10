"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const res = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }) });
    if (res.ok) router.push("/");
    else setError((await res.json()).error ?? "Could not change password");
  }
  const input = "w-full rounded-md border px-3 py-2";
  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-background p-8 shadow-sm">
      <h1 className="text-xl font-semibold">Change password</h1>
      <input className={input} type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      <input className={input} type="password" placeholder="New password (min 8)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button className="w-full rounded-md bg-primary px-3 py-2 text-primary-foreground" type="submit">Update password</button>
    </form>
  );
}
