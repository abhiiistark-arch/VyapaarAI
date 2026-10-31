"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { api, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const data = await api<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      if (!data?.access_token) throw new Error("Login succeeded but no token returned");
      setToken(data.access_token);
      router.replace("/overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-paper-100 p-12 lg:flex lg:flex-col lg:justify-between">
        <BrandMark />
        <div>
          <p className="font-display text-4xl font-semibold leading-tight text-ink-900">
            Demo workspace is ready for Rajveer Chinese.
          </p>
          <p className="mt-4 max-w-md text-ink-500">
            Email <span className="font-medium text-ink-700">owner@rajveerchinese.demo</span>
            <br />
            Password <span className="font-medium text-ink-700">vyapaarai123</span>
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-ink-400">VyapaarAI · Demo mode</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <form onSubmit={onSubmit} className="surface w-full max-w-md rounded-[28px] p-8">
          <h1 className="font-display text-3xl font-semibold">Welcome back</h1>
          <p className="mt-2 text-sm text-ink-500">Sign in to your VyapaarAI workspace.</p>
          <label className="mt-8 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Email</label>
          <input
            name="email"
            type="email"
            defaultValue="owner@rajveerchinese.demo"
            required
            className="mt-2 w-full rounded-2xl border border-paper-300 bg-paper-50 px-4 py-3 outline-none focus:border-leaf-500"
          />
          <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Password</label>
          <input
            name="password"
            type="password"
            defaultValue="vyapaarai123"
            required
            className="mt-2 w-full rounded-2xl border border-paper-300 bg-paper-50 px-4 py-3 outline-none focus:border-leaf-500"
          />
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <button
            disabled={loading}
            className="mt-6 w-full rounded-full bg-leaf-500 py-3 font-semibold text-white hover:bg-leaf-600 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Enter workspace"}
          </button>
          <p className="mt-5 text-center text-sm text-ink-500">
            New here?{" "}
            <Link href="/register" className="font-semibold text-leaf-600">
              Create a workspace
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
