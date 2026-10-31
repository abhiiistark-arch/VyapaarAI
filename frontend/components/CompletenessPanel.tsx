"use client";

import Link from "next/link";
import { CompletenessRing } from "@/components/CompletenessRing";

type Pillar = {
  id: string;
  label: string;
  weight: number;
  score: number;
  weighted: number;
};

type Props = {
  percent: number;
  label?: string;
  pillars?: Pillar[];
  title: string;
  hint: string;
  cta: string;
  loading?: boolean;
};

const shortLabels: Record<string, string> = {
  nap: "NAP",
  categories: "Categories",
  reviews: "Reviews",
  photos: "Photos",
  description: "Description",
  posts: "Posts",
};

export function CompletenessPanel({ percent, label, pillars = [], title, hint, cta, loading }: Props) {
  const rows = pillars.length
    ? pillars
    : Array.from({ length: 6 }).map((_, i) => ({
        id: `sk-${i}`,
        label: "—",
        weight: 0,
        score: 0,
        weighted: 0,
      }));

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-leaf-100 bg-gradient-to-br from-leaf-50 via-white to-paper-100 p-5 shadow-soft sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-leaf-100/70 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-amber-100/50 blur-2xl" />

      <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:gap-10">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf-700">{title}</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink-900 lg:text-3xl">
            {label || (loading ? "Scoring profile…" : "Profile health")}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">{hint}</p>
          <Link
            href="/audit"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-700"
          >
            {cta}
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mx-auto shrink-0">
          <CompletenessRing percent={percent} label={undefined} loading={loading} size={160} stroke={14} />
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
          {rows.map((pillar) => (
            <div
              key={pillar.id}
              className="min-w-0 overflow-hidden rounded-2xl border border-white/80 bg-white/90 px-3 py-3 shadow-sm backdrop-blur"
            >
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                {shortLabels[pillar.id] || pillar.label.slice(0, 12)}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-ink-900">
                {loading ? "—" : `${Math.round(pillar.score || 0)}%`}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-leaf-600 to-emerald-400 transition-all duration-1000 ease-out"
                  style={{ width: `${loading ? 12 : Math.round(pillar.score || 0)}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] font-medium text-ink-400">Weight {pillar.weight || 0}%</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
