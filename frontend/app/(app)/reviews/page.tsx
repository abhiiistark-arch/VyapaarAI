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
import { AiFeedback } from "@/components/AiFeedback";
import { api } from "@/lib/api";

type Review = {
  id: string;
  reviewer_name?: string;
  star_rating: number;
  comment?: string;
  review_created_at?: string;
  reply_comment?: string;
  is_answered: boolean;
  sentiment?: string;
  reply_source?: "demo_seed" | "ai" | "owner" | null;
};

type ReviewStats = {
  reviews: number;
  average_rating: number;
  unanswered_reviews: number;
  answered_reviews: number;
  response_rate_pct: number;
  by_sentiment: { positive: number; neutral: number; negative: number };
  by_stars: Record<string, number>;
  series: Array<{
    date: string;
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    avg_rating: number;
  }>;
};

function shortDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function replyLabel(source?: Review["reply_source"]) {
  if (source === "ai") return "AI-assisted reply (you can edit before publish)";
  if (source === "owner") return "Your reply";
  if (source === "demo_seed") return "Demo sample owner reply (not sent by you live)";
  return "Owner reply";
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [filter, setFilter] = useState<"all" | "unanswered" | "negative" | "positive" | "neutral">("all");
  const [busyId, setBusyId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiDraftIds, setAiDraftIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const qs = new URLSearchParams();
    if (filter === "unanswered") qs.set("answered", "false");
    if (filter === "negative" || filter === "positive" || filter === "neutral") qs.set("sentiment", filter);
    const query = qs.toString() ? `?${qs}` : "";
    const data = await api<{ items: Review[]; stats: ReviewStats }>(`/reviews${query}`);
    const rows = data.items || [];
    setReviews(rows);
    setStats(data.stats || null);
    const seed: Record<string, string> = {};
    rows.forEach((row) => {
      if (row.reply_comment) seed[row.id] = row.reply_comment;
    });
    setDrafts((prev) => ({ ...seed, ...prev }));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [filter]);

  const chartData = useMemo(() => {
    return (stats?.series || []).map((row) => ({
      ...row,
      label: shortDate(row.date),
    }));
  }, [stats]);

  async function generateReply(reviewId: string, improvementNotes = "") {
    setBusyId(reviewId);
    setError("");
    setNote("");
    try {
      const data = await api<{ reply: string }>("/reviews/generate-reply", {
        method: "POST",
        body: JSON.stringify({
          review_id: reviewId,
          tone: improvementNotes ? `friendly. Improve based on: ${improvementNotes}` : "friendly",
        }),
      });
      setDrafts((prev) => ({ ...prev, [reviewId]: data.reply }));
      setEditingId(reviewId);
      setAiDraftIds((prev) => ({ ...prev, [reviewId]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate reply");
    } finally {
      setBusyId("");
    }
  }

  function startManual(reviewId: string) {
    setEditingId(reviewId);
    setDrafts((prev) => ({ ...prev, [reviewId]: prev[reviewId] || "" }));
    setAiDraftIds((prev) => ({ ...prev, [reviewId]: false }));
    setNote("");
  }

  async function saveReply(reviewId: string, publish: boolean) {
    setBusyId(reviewId);
    setError("");
    try {
      const data = await api<{ note?: string; reply_comment: string }>("/reviews/reply", {
        method: "POST",
        body: JSON.stringify({
          review_id: reviewId,
          reply: drafts[reviewId] || "",
          publish,
          source: aiDraftIds[reviewId] ? "ai" : "owner",
        }),
      });
      setNote(data.note || (publish ? "Reply published locally / queued for Google." : "Draft saved."));
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save reply");
    } finally {
      setBusyId("");
    }
  }

  const sentiment = stats?.by_sentiment || { positive: 0, neutral: 0, negative: 0 };
  const stars = stats?.by_stars || { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

  return (
    <PageShell
      kicker="Reviews"
      title="AI draft or manual reply"
      description="Sentiment + star stats, trend graph, then draft with Gemini or write manually. Demo replies are labeled so you know what you sent vs sample data."
      action={
        <div className="flex flex-wrap gap-2">
          {(["all", "positive", "neutral", "negative", "unanswered"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
                filter === item ? "bg-ink-900 text-white" : "border border-paper-300 bg-white text-ink-500"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      }
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {note && <p className="mb-4 rounded-2xl bg-leaf-50 px-4 py-3 text-sm text-leaf-700">{note}</p>}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="surface rounded-[24px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Total reviews</p>
          <p className="mt-3 font-display text-3xl font-semibold">{stats?.reviews ?? "—"}</p>
          <p className="mt-1 text-xs text-ink-400">Avg {stats?.average_rating ?? "—"} ★</p>
        </article>
        <article className="surface rounded-[24px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-leaf-600">Positive</p>
          <p className="mt-3 font-display text-3xl font-semibold text-leaf-700">{sentiment.positive}</p>
          <p className="mt-1 text-xs text-ink-400">4–5 star sentiment</p>
        </article>
        <article className="surface rounded-[24px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">Neutral</p>
          <p className="mt-3 font-display text-3xl font-semibold text-amber-700">{sentiment.neutral}</p>
          <p className="mt-1 text-xs text-ink-400">3 star / mixed</p>
        </article>
        <article className="surface rounded-[24px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-600">Negative</p>
          <p className="mt-3 font-display text-3xl font-semibold text-red-700">{sentiment.negative}</p>
          <p className="mt-1 text-xs text-ink-400">
            Unanswered {stats?.unanswered_reviews ?? 0} · Response {stats?.response_rate_pct ?? 0}%
          </p>
        </article>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="surface rounded-[28px] p-5">
          <h2 className="font-display text-xl font-semibold">Review trend (30 days)</h2>
          <p className="mt-1 text-sm text-ink-500">Daily volume by sentiment</p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#eef0f4" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#98a2b3" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#98a2b3" }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total" stroke="#101828" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="positive" name="Positive" stroke="#059669" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="neutral" name="Neutral" stroke="#d97706" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="negative" name="Negative" stroke="#dc2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="surface rounded-[28px] p-5">
          <h2 className="font-display text-xl font-semibold">Star-wise breakdown</h2>
          <p className="mt-1 text-sm text-ink-500">Count of reviews per star rating</p>
          <div className="mt-5 space-y-3">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stars[String(star)] || 0;
              const total = stats?.reviews || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={star}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-ink-800">{"★".repeat(star)}</span>
                    <span className="text-ink-500">
                      {count} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-paper-200">
                    <div className="h-full rounded-full bg-ink-900" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <div className="space-y-4">
        {reviews.map((review) => (
          <article key={review.id} className="surface rounded-[28px] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink-900">{review.reviewer_name || "Customer"}</p>
                <p className="mt-1 text-sm text-ink-400">
                  {"★".repeat(review.star_rating)}
                  {"☆".repeat(5 - review.star_rating)} · {review.sentiment} ·{" "}
                  {review.is_answered ? "Answered" : "Needs reply"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => generateReply(review.id)}
                  disabled={busyId === review.id}
                  className="rounded-full bg-leaf-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busyId === review.id ? "Drafting…" : "AI reply draft"}
                </button>
                <button
                  onClick={() => startManual(review.id)}
                  className="rounded-full border border-paper-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700"
                >
                  Manual reply
                </button>
                {review.reply_comment && (
                  <button
                    onClick={() => {
                      setEditingId(review.id);
                      setDrafts((prev) => ({ ...prev, [review.id]: review.reply_comment || "" }));
                    }}
                    className="rounded-full border border-paper-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700"
                  >
                    Edit reply
                  </button>
                )}
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-700">{review.comment}</p>
            {review.reply_comment && editingId !== review.id && (
              <div className="mt-4 rounded-2xl bg-leaf-50 px-4 py-3 text-sm text-leaf-700">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-leaf-600">
                  {replyLabel(review.reply_source)}
                </p>
                <p className="mt-1">{review.reply_comment}</p>
              </div>
            )}
            {editingId === review.id && (
              <div className="mt-4 space-y-3">
                <textarea
                  value={drafts[review.id] || ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                  rows={4}
                  placeholder="Write or edit your reply…"
                  className="w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm"
                />
                {aiDraftIds[review.id] && (
                  <AiFeedback
                    busy={busyId === review.id}
                    label="How is this AI reply?"
                    onApprove={() => setNote("Reply approved. Edit if needed, then Save draft or Publish.")}
                    onImprove={(notes) => generateReply(review.id, notes)}
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => saveReply(review.id, false)}
                    disabled={busyId === review.id || !(drafts[review.id] || "").trim()}
                    className="rounded-full border border-paper-300 px-4 py-2 text-sm font-semibold"
                  >
                    Save draft
                  </button>
                  <button
                    onClick={() => saveReply(review.id, true)}
                    disabled={busyId === review.id || !(drafts[review.id] || "").trim()}
                    className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Publish reply
                  </button>
                  <button onClick={() => setEditingId(null)} className="rounded-full px-4 py-2 text-sm text-ink-400">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
        {!reviews.length && <p className="text-sm text-ink-400">No reviews match this filter.</p>}
      </div>
    </PageShell>
  );
}
