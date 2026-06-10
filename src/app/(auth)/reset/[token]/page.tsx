"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function ResetPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const res = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }) });
    if (res.ok) setDone(true);
    else setError((await res.json()).error ?? "Invalid or expired link");
  }
  const input = "w-full rounded-md border px-3 py-2";
  if (done) return (
    <div className="w-full max-w-sm space-y-4 rounded-xl border bg-background p-8 shadow-sm">
      <h1 className="text-xl font-semibold">Password updated</h1>
      <Link href="/login" className="block text-center text-sm text-muted-foreground hover:underline">Back to sign in</Link>
    </div>
  );
  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-background p-8 shadow-sm">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <input className={input} type="password" placeholder="New password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button className="w-full rounded-md bg-primary px-3 py-2 text-primary-foreground" type="submit">Set password</button>
    </form>
  );
}
