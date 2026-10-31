"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell } from "@/components/PageShell";
import { api, getToken } from "@/lib/api";

type DayPoint = {
  date: string;
  views: number;
  search: number;
  maps: number;
  calls: number;
  website: number;
  directions: number;
  messages: number;
  menu: number;
  bookings: number;
  actions: number;
};

type Engagement = {
  period_days: number;
  start_date: string;
  end_date: string;
  profile_views: number;
  search_views: number;
  maps_views: number;
  website_clicks: number;
  call_clicks: number;
  direction_requests: number;
  message_clicks: number;
  bookings: number;
  menu_clicks: number;
  total_actions: number;
  conversion_rate_pct: number;
  deltas: Record<string, number | null>;
  daily_series: DayPoint[];
  breakdown: {
    impressions_desktop_maps: number;
    impressions_desktop_search: number;
    impressions_mobile_maps: number;
    impressions_mobile_search: number;
  };
};

type Analytics = {
  engagement: Engagement;
  workspace: {
    reviews: number;
    unanswered_reviews: number;
    average_rating: number;
    total_posts: number;
    published_posts: number;
    photos: number;
  };
  reports: { id: string; title: string; period_label: string; status: string; created_at?: string }[];
  note?: string;
};

function fmt(n?: number) {
  if (n === undefined || n === null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toLocaleString();
}

function shortDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Fallback demo series if API returns empty — keeps chart visible. */
function buildFallbackSeries(days = 30): DayPoint[] {
  const out: DayPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const wave = i % 7;
    const search = 55 + wave * 4 + (i % 5);
    const maps = 38 + 96 + wave * 5 + (i % 4);
    const calls = 7 + wave;
    const website = 11 + wave;
    const directions = 16 + wave;
    const messages = 3 + (wave % 3);
    const menu = 5 + (wave % 4);
    const bookings = wave % 2;
    out.push({
      date: d.toISOString().slice(0, 10),
      search,
      maps,
      views: search + maps,
      calls,
      website,
      directions,
      messages,
      menu,
      bookings,
      actions: calls + website + directions + messages + menu + bookings,
    });
  }
  return out;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const payload = await api<Analytics>("/analytics?days=30");
    setData(payload);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function createReport() {
    setBusy(true);
    setError("");
    try {
      const report = await api<{ id: string; title: string; download_path: string }>("/analytics/reports?days=30", {
        method: "POST",
      });
      setNote(`Report ready: ${report.title}`);
      await load();
      const token = getToken();
      const base = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      const res = await fetch(`${base}/analytics/reports/${report.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vyapaarai-report-${report.id.slice(0, 8)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create report");
    } finally {
      setBusy(false);
    }
  }

  const eng = data?.engagement;
  const chartData = useMemo(() => {
    const raw = eng?.daily_series?.length ? eng.daily_series : buildFallbackSeries(30);
    return raw.map((row) => ({
      ...row,
      label: shortDate(row.date),
      views: Math.round(row.views || 0),
      search: Math.round(row.search || 0),
      maps: Math.round(row.maps || 0),
      calls: Math.round(row.calls || 0),
      website: Math.round(row.website || 0),
      directions: Math.round(row.directions || 0),
      messages: Math.round(row.messages || 0),
      menu: Math.round(row.menu || 0),
      bookings: Math.round(row.bookings || 0),
      actions: Math.round(row.actions || 0),
    }));
  }, [eng?.daily_series]);

  return (
    <PageShell
      kicker="Analytics & reports"
      title="Performance you can act on"
      description="Profile views, calls, website clicks, and directions from Google Business Profile Performance metrics (demo seeded now; live API on env switch)."
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {note && <p className="mb-4 rounded-2xl bg-leaf-50 px-4 py-3 text-sm text-leaf-700">{note}</p>}
      {data?.note && <p className="mb-4 text-xs text-ink-400">{data.note}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Profile views", eng?.profile_views, eng?.deltas?.profile_views_pct],
          ["Website clicks", eng?.website_clicks, eng?.deltas?.website_clicks_pct],
          ["Call clicks", eng?.call_clicks, eng?.deltas?.call_clicks_pct],
          ["Direction requests", eng?.direction_requests, eng?.deltas?.direction_requests_pct],
        ].map(([label, value, delta]) => (
          <article key={String(label)} className="surface rounded-[28px] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">{label as string}</p>
            <p className="mt-3 font-display text-3xl font-semibold">{fmt(value as number)}</p>
            <p className="mt-2 text-xs text-ink-400">
              {typeof delta === "number" ? `${delta >= 0 ? "+" : ""}${delta}% vs prior period` : "vs prior period"}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <article className="surface rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Maps impressions</p>
          <p className="mt-3 font-display text-3xl font-semibold">{fmt(eng?.maps_views)}</p>
          <p className="mt-2 text-xs text-ink-400">
            Desktop {fmt(eng?.breakdown?.impressions_desktop_maps)} · Mobile {fmt(eng?.breakdown?.impressions_mobile_maps)}
          </p>
        </article>
        <article className="surface rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Search impressions</p>
          <p className="mt-3 font-display text-3xl font-semibold">{fmt(eng?.search_views)}</p>
          <p className="mt-2 text-xs text-ink-400">
            Desktop {fmt(eng?.breakdown?.impressions_desktop_search)} · Mobile {fmt(eng?.breakdown?.impressions_mobile_search)}
          </p>
        </article>
        <article className="surface rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Action rate</p>
          <p className="mt-3 font-display text-3xl font-semibold">{eng ? `${eng.conversion_rate_pct}%` : "—"}</p>
          <p className="mt-2 text-xs text-ink-400">
            {eng ? `${fmt(eng.total_actions)} actions · msgs ${fmt(eng.message_clicks)} · menu ${fmt(eng.menu_clicks)}` : ""}
          </p>
        </article>
      </section>

      <article className="surface mt-4 rounded-[28px] p-6">
        <h2 className="font-display text-xl font-semibold">Profile views trend</h2>
        <p className="mt-1 text-sm text-ink-500">
          Last {chartData.length} days · total views, Search & Maps (demo metrics)
        </p>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#E8E2DA" strokeDasharray="4 4" />
              <XAxis dataKey="label" tick={{ fill: "#8A7B71", fontSize: 11 }} minTickGap={24} />
              <YAxis tick={{ fill: "#8A7B71", fontSize: 11 }} width={40} />
              <Tooltip
                contentStyle={{ borderRadius: 16, borderColor: "#E8E2DA" }}
                labelStyle={{ color: "#1F1A17" }}
              />
              <Legend />
              <Line type="monotone" dataKey="views" name="Profile views" stroke="#2F6B4F" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="search" name="Search" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="maps" name="Maps" stroke="#C45C26" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="surface mt-4 rounded-[28px] p-6">
        <h2 className="font-display text-xl font-semibold">Engagement actions</h2>
        <p className="mt-1 text-sm text-ink-500">
          Daily performance for website, calls, directions, messages, menu & bookings
        </p>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#E8E2DA" strokeDasharray="4 4" />
              <XAxis dataKey="label" tick={{ fill: "#8A7B71", fontSize: 11 }} minTickGap={24} />
              <YAxis tick={{ fill: "#8A7B71", fontSize: 11 }} width={36} />
              <Tooltip
                contentStyle={{ borderRadius: 16, borderColor: "#E8E2DA" }}
                labelStyle={{ color: "#1F1A17" }}
              />
              <Legend />
              <Line type="monotone" dataKey="website" name="Website" stroke="#2563EB" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="calls" name="Calls" stroke="#16A34A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="directions" name="Directions" stroke="#C45C26" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="messages" name="Messages" stroke="#7C3AED" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="menu" name="Menu" stroke="#DB2777" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="bookings" name="Bookings" stroke="#0F766E" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="actions" name="All actions" stroke="#1F1A17" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="surface rounded-[28px] p-6">
          <h2 className="font-display text-xl font-semibold">Workspace snapshot</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <p>Reviews: <strong>{data?.workspace.reviews ?? "—"}</strong></p>
            <p>Unanswered: <strong>{data?.workspace.unanswered_reviews ?? "—"}</strong></p>
            <p>Avg rating: <strong>{data?.workspace.average_rating ?? "—"}</strong></p>
            <p>Published posts: <strong>{data?.workspace.published_posts ?? "—"}</strong></p>
            <p>Photos: <strong>{data?.workspace.photos ?? "—"}</strong></p>
            <p>Total posts: <strong>{data?.workspace.total_posts ?? "—"}</strong></p>
          </div>
        </article>
        <article className="surface rounded-[28px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold">Client reports</h2>
              <p className="mt-1 text-sm text-ink-500">Download a text performance report for this period.</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={createReport}
              className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
            >
              {busy ? "Building…" : "Generate & download"}
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {(data?.reports || []).map((report) => (
              <div key={report.id} className="rounded-2xl bg-paper-100 px-4 py-3 text-sm">
                <p className="font-semibold text-ink-800">{report.title}</p>
                <p className="text-xs text-ink-400">{report.period_label}</p>
              </div>
            ))}
            {!data?.reports?.length && <p className="text-sm text-ink-400">No reports yet — generate one above.</p>}
          </div>
        </article>
      </section>
    </PageShell>
  );
}
