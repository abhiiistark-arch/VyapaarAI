"use client";

import { useEffect, useState } from "react";
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
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<"all" | "unanswered" | "negative">("all");
  const [busyId, setBusyId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiDraftIds, setAiDraftIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const query =
      filter === "unanswered" ? "?answered=false" : filter === "negative" ? "?sentiment=negative" : "";
    const data = await api<{ items: Review[] }>(`/reviews${query}`);
    const rows = data.items || [];
    setReviews(rows);
    const seed: Record<string, string> = {};
    rows.forEach((row) => {
      if (row.reply_comment) seed[row.id] = row.reply_comment;
    });
    setDrafts((prev) => ({ ...seed, ...prev }));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [filter]);

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

  return (
    <PageShell
      kicker="Reviews"
      title="AI draft or manual reply"
      description="Generate with Gemini, write manually, edit freely, then save/publish. Live Google push uses the same endpoint when APIs are enabled."
      action={
        <div className="flex gap-2">
          {(["all", "unanswered", "negative"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
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
                  {busyId === review.id ? "Drafting (may take ~10–30s)…" : "AI reply draft"}
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
                Owner reply: {review.reply_comment}
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
