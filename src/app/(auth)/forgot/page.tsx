"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }) });
    const j = await res.json().catch(() => ({}));
    if (j.emailConfigured === false) setMsg("Email isn't configured; ask an administrator to reset your password.");
    else setMsg("If that email exists, a reset link has been sent.");
  }
  const input = "w-full rounded-md border px-3 py-2";
  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-background p-8 shadow-sm">
      <h1 className="text-xl font-semibold">Reset password</h1>
      <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      {msg && <p className="text-sm">{msg}</p>}
      <button className="w-full rounded-md bg-primary px-3 py-2 text-primary-foreground" type="submit">Send reset link</button>
      <Link href="/login" className="block text-center text-sm text-muted-foreground hover:underline">Back to sign in</Link>
    </form>
  );
}
