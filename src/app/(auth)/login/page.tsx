"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }) });
    if (res.ok) { const j = await res.json(); router.push(j.mustChangePassword ? "/change-password" : "/"); }
    else setError("Invalid credentials");
  }
  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
  return (
    <form onSubmit={submit} className="card-elev w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight">DMARC Dashboard</h1>
        <p className="text-sm text-muted-foreground">Sign in to continue</p>
      </div>
      <input className={input} placeholder="Username or email" value={login} onChange={(e) => setLogin(e.target.value)} />
      <input className={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90" type="submit">Sign in</button>
      <Link href="/forgot" className="block text-center text-sm text-muted-foreground hover:underline">Forgot password?</Link>
    </form>
  );
}
