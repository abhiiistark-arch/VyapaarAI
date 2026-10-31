"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CompletenessRing } from "@/components/CompletenessRing";
import { PageShell } from "@/components/PageShell";
import { api } from "@/lib/api";

type Audit = {
  overall_score: number;
  label: string;
  tone: string;
  note?: string;
  location: { id: string; title: string; address?: string; primary_category?: string };
  pillars: { id: string; label: string; weight: number; score: number; weighted: number; findings: string[] }[];
  priority_fixes: { id: string; title: string; detail: string; pillar: string }[];
  checklist: { status: string; title: string; detail: string; pillar: string }[];
  competitors: { name: string; score: number; gap_vs_you: number; missing_on_yours: string }[];
  optimize_path: string;
};

export default function AuditPage() {
  const [data, setData] = useState<Audit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function runAudit() {
    setBusy(true);
    setError("");
    try {
      const payload = await api<Audit>("/audit/run", { method: "POST", body: JSON.stringify({}) });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    runAudit().catch(() => undefined);
  }, []);

  const icon = (status: string) => (status === "pass" ? "✅" : status === "warn" ? "⚠️" : "❌");

  return (
    <PageShell
      kicker="SEO & profile audit"
      title={data ? `${data.location.title} health` : "Run profile audit"}
      description="Weighted GBP completeness score (NAP, categories, reviews, photos, description, posts). Not an official Google ranking."
      action={
        <button
          type="button"
          onClick={runAudit}
          disabled={busy}
          className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Running…" : "Run audit"}
        </button>
      }
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="surface flex flex-col items-center rounded-[28px] p-8">
          <CompletenessRing percent={data?.overall_score ?? 0} label={data?.label} size={168} stroke={14} />
          <p className="mt-4 max-w-sm text-center text-sm text-ink-500">{data?.note}</p>
          {data && (
            <Link
              href={data.optimize_path || "/optimizer"}
              className="mt-5 rounded-full bg-leaf-500 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Optimize accordingly
            </Link>
          )}
        </article>

        <article className="surface rounded-[28px] p-6">
          <h2 className="font-display text-xl font-semibold text-red-700">Priority fixes</h2>
          <div className="mt-4 space-y-3">
            {(data?.priority_fixes || []).map((fix) => (
              <div key={fix.id} className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                <p className="text-sm font-semibold text-red-800">{fix.title}</p>
                <p className="mt-1 text-sm text-red-700/80">{fix.detail}</p>
              </div>
            ))}
            {!data?.priority_fixes?.length && (
              <p className="text-sm text-ink-400">No critical blockers — keep improving warnings below.</p>
            )}
          </div>
        </article>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(data?.pillars || []).map((p) => (
          <article key={p.id} className="surface rounded-[24px] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
              Weight {p.weight}%
            </p>
            <p className="mt-1 text-sm font-semibold text-ink-900">{p.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{Math.round(p.score)}%</p>
            <p className="mt-1 text-xs text-ink-400">Contributes {p.weighted} pts</p>
          </article>
        ))}
      </section>

      <section className="mt-6 surface rounded-[28px] p-6">
        <h2 className="font-display text-xl font-semibold">Actionable checklist</h2>
        <div className="mt-4 space-y-3">
          {(data?.checklist || []).map((item, idx) => (
            <div key={`${item.title}-${idx}`} className="rounded-2xl bg-paper-100 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">
                {icon(item.status)} {item.title}
              </p>
              <p className="mt-1 text-sm text-ink-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 surface rounded-[28px] p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Local competitor snapshot</h2>
            <p className="mt-1 text-sm text-ink-500">Demo comparison of nearby profiles vs your score.</p>
          </div>
          <Link
            href={data?.optimize_path || "/optimizer"}
            className="rounded-full border border-paper-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700"
          >
            Optimize accordingly
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(data?.competitors || []).map((c) => (
            <article key={c.name} className="rounded-2xl bg-paper-100 px-4 py-4">
              <p className="text-sm font-semibold text-ink-900">{c.name}</p>
              <p className="mt-2 font-display text-3xl font-semibold">{c.score}</p>
              <p className="mt-1 text-xs text-ink-400">
                {c.gap_vs_you >= 0 ? `+${c.gap_vs_you}` : c.gap_vs_you} vs you
              </p>
              <p className="mt-3 text-sm text-ink-600">{c.missing_on_yours}</p>
            </article>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
