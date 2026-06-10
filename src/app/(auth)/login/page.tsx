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
  const input = "w-full rounded-md border px-3 py-2";
  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-background p-8 shadow-sm">
      <h1 className="text-xl font-semibold">DMARC Dashboard</h1>
      <input className={input} placeholder="Username or email" value={login} onChange={(e) => setLogin(e.target.value)} />
      <input className={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button className="w-full rounded-md bg-primary px-3 py-2 text-primary-foreground" type="submit">Sign in</button>
      <Link href="/forgot" className="block text-center text-sm text-muted-foreground hover:underline">Forgot password?</Link>
    </form>
  );
}
