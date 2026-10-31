"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CompletenessRing } from "@/components/CompletenessRing";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import type { TranslationKey } from "@/lib/i18n/translations";

type Engagement = {
  period_days: number;
  start_date: string;
  end_date: string;
  profile_views: number;
  website_clicks: number;
  call_clicks: number;
  direction_requests: number;
  conversion_rate_pct: number;
  deltas: {
    profile_views_pct: number | null;
    website_clicks_pct: number | null;
    call_clicks_pct: number | null;
    direction_requests_pct: number | null;
  };
};

type Overview = {
  connection: { status: string; google_email?: string };
  engagement?: Engagement;
  profile_completeness?: {
    percent: number;
    label: string;
    tone: string;
    pillars: { id: string; label: string; weight: number; score: number; weighted: number }[];
  };
  stats: {
    businesses: number;
    locations: number;
    reviews: number;
    average_rating: number;
    unanswered_reviews: number;
    total_posts: number;
    published_posts: number;
    scheduled_posts: number;
    draft_posts: number;
    photos: number;
    pending_tasks: number;
  };
  tasks: { id: string; title: string; description: string; priority: string }[];
  locations: { id: string; title: string; address?: string; primary_category?: string; is_selected: boolean }[];
};

type PresetKey = "today" | "7d" | "30d" | "month" | "quarter" | "year";

const workspaceCards: { key: keyof Overview["stats"]; labelKey: TranslationKey }[] = [
  { key: "locations", labelKey: "overview.locations" },
  { key: "reviews", labelKey: "overview.reviews" },
  { key: "average_rating", labelKey: "overview.avgRating" },
  { key: "unanswered_reviews", labelKey: "overview.unanswered" },
  { key: "total_posts", labelKey: "overview.allPosts" },
  { key: "published_posts", labelKey: "overview.published" },
  { key: "scheduled_posts", labelKey: "overview.scheduled" },
  { key: "draft_posts", labelKey: "overview.drafts" },
  { key: "photos", labelKey: "overview.photos" },
  { key: "pending_tasks", labelKey: "overview.openTasks" },
];

const PRESETS: { key: PresetKey; labelKey: TranslationKey }[] = [
  { key: "today", labelKey: "overview.today" },
  { key: "7d", labelKey: "overview.7d" },
  { key: "30d", labelKey: "overview.30d" },
  { key: "month", labelKey: "overview.month" },
  { key: "quarter", labelKey: "overview.quarter" },
  { key: "year", labelKey: "overview.year" },
];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(key: PresetKey): { start: string; end: string } {
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  if (key === "today") {
    /* start === end */
  } else if (key === "7d") start.setDate(end.getDate() - 6);
  else if (key === "30d") start.setDate(end.getDate() - 29);
  else if (key === "month") start.setDate(1);
  else if (key === "quarter") {
    const q = Math.floor(end.getMonth() / 3) * 3;
    start.setMonth(q, 1);
  } else {
    start.setMonth(0, 1);
  }
  return { start: iso(start), end: iso(end) };
}

export default function OverviewPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [preset, setPreset] = useState<PresetKey>("30d");
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const initial = useMemo(() => rangeForPreset("30d"), []);
  const [customStart, setCustomStart] = useState(initial.start);
  const [customEnd, setCustomEnd] = useState(initial.end);
  const [appliedStart, setAppliedStart] = useState(initial.start);
  const [appliedEnd, setAppliedEnd] = useState(initial.end);

  async function load(start: string, end: string) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ start_date: start, end_date: end });
      const payload = await api<Overview>(`/dashboard/overview?${qs.toString()}`);
      setData(payload);
      setAppliedStart(start);
      setAppliedEnd(end);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load overview");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const range = rangeForPreset("30d");
    load(range.start, range.end).catch(() => undefined);
  }, []);

  function applyPreset(key: PresetKey) {
    setPreset(key);
    setMode("preset");
    const range = rangeForPreset(key);
    setCustomStart(range.start);
    setCustomEnd(range.end);
    load(range.start, range.end);
  }

  function applyCustomRange() {
    if (!customStart || !customEnd) {
      setError("Pick both start and end dates.");
      return;
    }
    let start = customStart;
    let end = customEnd;
    if (start > end) {
      [start, end] = [end, start];
      setCustomStart(start);
      setCustomEnd(end);
    }
    setMode("custom");
    load(start, end);
  }

  const eng = data?.engagement;

  return (
    <main className="px-6 py-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf-600">{t("overview.eyebrow")}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{t("overview.title")}</h1>
          <p className="mt-2 text-sm text-ink-500">
            {data?.connection.google_email
              ? t("overview.connectedAs", { email: data.connection.google_email })
              : t("overview.demoNote")}
          </p>
        </div>
        <Link href="/analytics" className="rounded-full border border-paper-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700 shadow-soft">
          {t("overview.fullAnalytics")}
        </Link>
      </div>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      <section className="mt-6 surface rounded-[28px] p-6">
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
              {t("overview.completeness")}
            </p>
            <p className="mt-2 text-sm text-ink-500">{t("overview.completenessHint")}</p>
            <Link
              href="/audit"
              className="mt-4 inline-flex rounded-full border border-paper-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700"
            >
              {t("overview.viewAudit")}
            </Link>
          </div>
          <CompletenessRing
            percent={data?.profile_completeness?.percent ?? 0}
            label={data?.profile_completeness?.label}
          />
          <div className="grid w-full max-w-md grid-cols-2 gap-2 sm:grid-cols-3">
            {(data?.profile_completeness?.pillars || []).slice(0, 6).map((pillar) => (
              <div key={pillar.id} className="rounded-2xl bg-paper-100 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                  {pillar.weight}%
                </p>
                <p className="mt-1 text-xs font-semibold text-ink-800 line-clamp-2">{pillar.label}</p>
                <p className="mt-1 font-display text-lg font-semibold text-ink-900">{Math.round(pillar.score)}%</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="surface rounded-[28px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">{t("overview.quickPeriod")}</p>
          <p className="mt-1 text-sm text-ink-500">{t("overview.quickPeriodHint")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={loading}
                onClick={() => applyPreset(item.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  mode === "preset" && preset === item.key
                    ? "bg-ink-900 text-white"
                    : "border border-paper-300 bg-white text-ink-700"
                }`}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>
        </article>

        <article className="surface rounded-[28px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">{t("overview.customRange")}</p>
          <p className="mt-1 text-sm text-ink-500">{t("overview.customRangeHint")}</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
              {t("overview.from")}
              <input
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setMode("custom");
                }}
                className="mt-2 block rounded-2xl border border-paper-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink-800"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
              {t("overview.to")}
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setMode("custom");
                }}
                className="mt-2 block rounded-2xl border border-paper-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink-800"
              />
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={applyCustomRange}
              className="rounded-full bg-leaf-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? t("overview.loading") : t("overview.apply")}
            </button>
          </div>
        </article>
      </section>

      <p className="mt-3 text-xs text-ink-400">
        {t("overview.showing")} <strong className="text-ink-600">{appliedStart}</strong> →{" "}
        <strong className="text-ink-600">{appliedEnd}</strong>
        {eng ? ` · ${eng.period_days} ${t("overview.days")}` : ""}
        {loading ? ` · ${t("overview.refreshing")}` : ""}
      </p>

      <section className="mt-6">
        <h2 className="font-display text-2xl font-semibold">{t("overview.engagement")}</h2>
        <p className="mt-1 text-sm text-ink-500">{t("overview.engagementHint")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ["overview.profileViews", eng?.profile_views, eng?.deltas.profile_views_pct],
              ["overview.websiteClicks", eng?.website_clicks, eng?.deltas.website_clicks_pct],
              ["overview.callClicks", eng?.call_clicks, eng?.deltas.call_clicks_pct],
              ["overview.directions", eng?.direction_requests, eng?.deltas.direction_requests_pct],
            ] as const
          ).map(([labelKey, value, delta]) => (
            <article key={labelKey} className="surface rounded-[24px] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">{t(labelKey)}</p>
              <p className="mt-3 font-display text-3xl font-semibold">
                {typeof value === "number" ? value.toLocaleString() : "—"}
              </p>
              <p className="mt-2 text-xs text-ink-400">
                {typeof delta === "number" ? `${delta >= 0 ? "+" : ""}${delta}% ${t("overview.vsPrior")}` : t("overview.vsPrior")}
              </p>
            </article>
          ))}
        </div>
        {eng && (
          <p className="mt-3 text-xs text-ink-400">
            {t("overview.actionRate", { rate: eng.conversion_rate_pct })}
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("overview.workspace")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {workspaceCards.map((card) => (
            <article key={card.key} className="surface rounded-[24px] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">{t(card.labelKey)}</p>
              <p className="mt-3 font-display text-3xl font-semibold">{data ? data.stats[card.key] : "—"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="surface rounded-[28px] p-6">
          <h2 className="font-display text-2xl font-semibold">{t("overview.pendingTasks")}</h2>
          <div className="mt-4 space-y-3">
            {(data?.tasks.length ? data.tasks : []).map((task) => (
              <div key={task.id} className="rounded-2xl bg-paper-100 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink-900">{task.title}</p>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-leaf-600">{task.priority}</span>
                </div>
                <p className="mt-1 text-sm text-ink-500">{task.description}</p>
              </div>
            ))}
            {!data?.tasks.length && <p className="text-sm text-ink-400">{t("overview.noTasks")}</p>}
          </div>
        </article>
        <article className="surface rounded-[28px] p-6">
          <h2 className="font-display text-2xl font-semibold">{t("overview.locationsTitle")}</h2>
          <div className="mt-4 space-y-3">
            {data?.locations.map((location) => (
              <div key={location.id} className="rounded-2xl bg-paper-100 px-4 py-3">
                <p className="text-sm font-semibold">{location.title}</p>
                <p className="text-xs text-ink-400">{location.primary_category || t("overview.noCategory")}</p>
                <p className="mt-1 text-xs text-ink-400">{location.address}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
