"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { api, setToken } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const data = await api<{ access_token: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: form.get("full_name"),
          email: form.get("email"),
          password: form.get("password"),
          business_name: form.get("business_name"),
          role: form.get("role"),
        }),
      });
      setToken(data.access_token);
      router.push("/overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create workspace");
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
            Clean white workspace for local growth.
          </p>
          <p className="mt-4 max-w-md text-ink-500">
            Prefer the seeded Rajveer Chinese demo? Use the Sign in page instead.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-ink-400">Owners · Agencies · Teams</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <form onSubmit={onSubmit} className="surface w-full max-w-md rounded-[28px] p-8">
          <h1 className="font-display text-3xl font-semibold">Create workspace</h1>
          <div className="mt-8 grid gap-4">
            <input name="full_name" required placeholder="Your name" className="rounded-2xl border border-paper-300 bg-paper-50 px-4 py-3 outline-none focus:border-leaf-500" />
            <input name="business_name" required placeholder="Agency or business name" className="rounded-2xl border border-paper-300 bg-paper-50 px-4 py-3 outline-none focus:border-leaf-500" />
            <input name="email" type="email" required placeholder="Work email" className="rounded-2xl border border-paper-300 bg-paper-50 px-4 py-3 outline-none focus:border-leaf-500" />
            <input name="password" type="password" required minLength={8} placeholder="Password, 8+ characters" className="rounded-2xl border border-paper-300 bg-paper-50 px-4 py-3 outline-none focus:border-leaf-500" />
            <select name="role" className="rounded-2xl border border-paper-300 bg-paper-50 px-4 py-3 outline-none">
              <option value="owner">Business owner</option>
              <option value="agency_manager">Agency manager</option>
              <option value="team_member">Team member</option>
            </select>
          </div>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <button disabled={loading} className="mt-6 w-full rounded-full bg-leaf-500 py-3 font-semibold text-white disabled:opacity-60">
            {loading ? "Creating…" : "Create workspace"}
          </button>
          <p className="mt-5 text-center text-sm text-ink-500">
            Already have access?{" "}
            <Link href="/login" className="font-semibold text-leaf-600">
              Sign in
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
