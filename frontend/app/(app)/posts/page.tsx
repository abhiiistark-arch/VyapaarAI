"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AiFeedback } from "@/components/AiFeedback";
import { api } from "@/lib/api";

type Post = {
  id: string;
  post_type: string;
  summary: string;
  status: string;
  cta_type?: string;
  cta_url?: string;
  scheduled_for?: string;
};

type Media = {
  id: string;
  source_url?: string;
  category?: string;
  caption?: string;
  status: string;
  media_format?: string;
};

type PostStats = {
  total_posts: number;
  published_posts: number;
  scheduled_posts: number;
  draft_posts: number;
  pending_sync_posts: number;
};

type Location = { id: string; title: string; website?: string };

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [stats, setStats] = useState<PostStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "scheduled" | "draft">("all");
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");

  const [topic, setTopic] = useState("Weekend Schezwan special + takeaway near high school");
  const [tone, setTone] = useState("friendly");
  const [summary, setSummary] = useState("");
  const [postType, setPostType] = useState("STANDARD");
  const [ctaType, setCtaType] = useState("LEARN_MORE");
  const [ctaUrl, setCtaUrl] = useState("");
  const [postMediaUrl, setPostMediaUrl] = useState("");
  const [postMediaFormat, setPostMediaFormat] = useState<"PHOTO" | "VIDEO">("PHOTO");
  const [scheduleAt, setScheduleAt] = useState("");
  const [showAiDraft, setShowAiDraft] = useState(false);

  const [photoUrl, setPhotoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [photoCategory, setPhotoCategory] = useState("FOOD_AND_DRINK");
  const [photoAiPrompt, setPhotoAiPrompt] = useState("Hot Veg Manchurian plating, natural light, restaurant table");
  const [showPhotoAi, setShowPhotoAi] = useState(false);
  const [photoAiKey, setPhotoAiKey] = useState(0);
  const [photoDraftMode, setPhotoDraftMode] = useState<"full" | "caption" | null>(null);
  const [showPostMediaAi, setShowPostMediaAi] = useState(false);
  const [postMediaAiKey, setPostMediaAiKey] = useState(0);

  const [batchTopics, setBatchTopics] = useState(
    "Monday Hakka noodles special\nWednesday family feast offer\nFriday Schezwan combo\nWeekend takeaway reminder"
  );
  const [batchInterval, setBatchInterval] = useState(2);
  const [batchWithImages, setBatchWithImages] = useState(false);

  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const statusQuery = statusFilter === "all" ? "" : `?status=${statusFilter}`;
    const mediaQuery = locationId ? `?location_id=${locationId}` : "";
    const postQuery = locationId
      ? `${statusQuery}${statusQuery ? "&" : "?"}location_id=${locationId}`
      : statusQuery;
    const [postData, mediaData, locs] = await Promise.all([
      api<{ items: Post[]; stats: PostStats }>(`/posts${postQuery}`),
      api<{ items: Media[] }>(`/posts/media${mediaQuery}`),
      api<Location[]>("/google/locations"),
    ]);
    setPosts(postData.items || []);
    setStats(postData.stats || null);
    setMedia(mediaData.items || []);
    setLocations(locs);
    if (!locationId && locs[0]) {
      setLocationId(locs[0].id);
      setCtaUrl(locs[0].website || "");
    }
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [statusFilter, locationId]);

  async function generateAi(extraNotes = "") {
    if (!locationId) return;
    setLoading(true);
    setError("");
    try {
      const data = await api<{
        summary: string;
        post_type?: string;
        cta_type?: string;
        cta_url_suggestion?: string;
      }>("/posts/generate", {
        method: "POST",
        body: JSON.stringify({
          location_id: locationId,
          topic: extraNotes ? `${topic}\nImprovement notes: ${extraNotes}` : topic,
          tone,
          mode: "post",
        }),
      });
      setSummary(data.summary || "");
      if (data.post_type) setPostType(data.post_type);
      if (data.cta_type) setCtaType(data.cta_type);
      if (data.cta_url_suggestion) setCtaUrl(data.cta_url_suggestion);
      setShowAiDraft(true);
      setNote("AI draft ready — edit any field, then save, publish, or schedule.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function generateAiImageForPost(extraNotes = "") {
    if (!locationId) return;
    setLoading(true);
    setError("");
    try {
      const briefBase = topic || summary || "Marketing visual for Google post";
      const data = await api<{
        source_url: string;
        caption?: string;
        note?: string;
        revision_applied?: string[];
        generation_source?: string;
      }>("/posts/media/generate", {
        method: "POST",
        body: JSON.stringify({
          location_id: locationId,
          brief: extraNotes ? `${briefBase}\nImprovement notes: ${extraNotes}` : briefBase,
          category: "ADDITIONAL",
          style: "photorealistic food photography",
          save: false,
        }),
      });
      setPostMediaUrl(`${data.source_url}?v=${Date.now()}`);
      setPostMediaFormat("PHOTO");
      setShowPostMediaAi(true);
      setPostMediaAiKey((k) => k + 1);
      const applied = (data.revision_applied || []).filter(Boolean).join("; ");
      setNote(
        [
          data.note || (extraNotes ? "Post photo regenerated with your notes." : "AI image attached."),
          applied ? `Applied: ${applied}` : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI image failed");
    } finally {
      setLoading(false);
    }
  }

  async function generateCaption(extraNotes = "") {
    if (!locationId) return;
    setLoading(true);
    setError("");
    try {
      const data = await api<{ summary?: string; caption?: string }>("/posts/generate", {
        method: "POST",
        body: JSON.stringify({
          location_id: locationId,
          topic: extraNotes ? `${photoAiPrompt}\nImprovement notes: ${extraNotes}` : photoAiPrompt,
          tone: "friendly",
          mode: "caption",
        }),
      });
      setCaption(data.caption || data.summary || "");
      setPhotoDraftMode("caption");
      setShowPhotoAi(true);
      setPhotoAiKey((k) => k + 1);
      setNote(extraNotes ? "Caption regenerated with your notes." : "AI caption ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Caption generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function generateFullPhoto(extraNotes = "") {
    if (!locationId) return;
    setLoading(true);
    setError("");
    try {
      const data = await api<{
        source_url: string;
        caption?: string;
        note?: string;
        revision_applied?: string[];
        generation_source?: string;
        media?: { id: string };
      }>("/posts/media/generate", {
        method: "POST",
        body: JSON.stringify({
          location_id: locationId,
          brief: extraNotes ? `${photoAiPrompt}\nImprovement notes: ${extraNotes}` : photoAiPrompt,
          category: photoCategory,
          style: "photorealistic food photography",
          save: true,
        }),
      });
      setPhotoUrl(`${data.source_url}?v=${Date.now()}`);
      if (data.caption) setCaption(data.caption);
      setPhotoDraftMode("full");
      setShowPhotoAi(true);
      setPhotoAiKey((k) => k + 1);
      const applied = (data.revision_applied || []).filter(Boolean).join("; ");
      setNote(
        [
          data.note || (extraNotes ? "Photo regenerated with your notes." : "AI photo generated."),
          applied ? `Applied: ${applied}` : "",
          data.generation_source === "svg_poster_fallback"
            ? "Tip: free image quota may be busy — retry for photorealistic Gemini shots."
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI photo generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function savePost(event: FormEvent, status: "draft" | "published" | "scheduled") {
    event.preventDefault();
    if (!locationId || !summary.trim()) return;
    if (status === "scheduled" && !scheduleAt) {
      setError("Pick a schedule date/time first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api<{ note: string }>("/posts", {
        method: "POST",
        body: JSON.stringify({
          location_id: locationId,
          summary,
          status: status === "scheduled" ? "scheduled" : status,
          post_type: postType,
          cta_type: ctaType,
          cta_url: ctaUrl || undefined,
          media_url: postMediaUrl || undefined,
          media_format: postMediaFormat,
          scheduled_for: status === "scheduled" ? new Date(scheduleAt).toISOString() : undefined,
        }),
      });
      setNote(data.note || (status === "scheduled" ? "Post scheduled." : "Post saved."));
      setSummary("");
      setPostMediaUrl("");
      setShowAiDraft(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save post");
    } finally {
      setLoading(false);
    }
  }

  async function savePhoto(event: FormEvent) {
    event.preventDefault();
    if (!locationId || !photoUrl.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await api<{ note: string }>("/posts/media", {
        method: "POST",
        body: JSON.stringify({
          location_id: locationId,
          source_url: photoUrl,
          caption,
          category: photoCategory,
          media_format: "PHOTO",
        }),
      });
      setNote(data.note);
      setPhotoUrl("");
      setCaption("");
      setShowPhotoAi(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add photo");
    } finally {
      setLoading(false);
    }
  }

  async function scheduleTopicBatch() {
    if (!locationId) return;
    const topics = batchTopics
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!topics.length) {
      setError("Add at least one topic line.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api<{ count: number; note: string }>("/posts/schedule-batch", {
        method: "POST",
        body: JSON.stringify({
          location_id: locationId,
          topics,
          tone,
          interval_days: batchInterval,
          generate_ai_copy: true,
          attach_ai_image: batchWithImages,
          start_at: scheduleAt ? new Date(scheduleAt).toISOString() : undefined,
        }),
      });
      setNote(data.note || `Scheduled ${data.count} posts.`);
      setStatusFilter("scheduled");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch schedule failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      kicker="Posts & photos"
      title="Create, AI-generate, and schedule"
      description="Write posts, attach AI photos/videos, schedule one-off or a topic list. Existing manual flows stay available."
    >
      <div className="mb-4">
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="rounded-2xl border border-paper-300 bg-white px-4 py-3"
        >
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.title}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {note && <p className="mb-4 rounded-2xl bg-leaf-50 px-4 py-3 text-sm text-leaf-700">{note}</p>}

      {stats && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">
          <span className="rounded-full bg-paper-100 px-3 py-1">Total {stats.total_posts}</span>
          <span className="rounded-full bg-leaf-50 px-3 py-1 text-leaf-700">Published {stats.published_posts}</span>
          <span className="rounded-full bg-paper-100 px-3 py-1">Scheduled {stats.scheduled_posts}</span>
          <span className="rounded-full bg-paper-100 px-3 py-1">Drafts {stats.draft_posts}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <form className="surface rounded-[28px] p-6" onSubmit={(e) => savePost(e, "draft")}>
          <h2 className="font-display text-xl font-semibold">New Google Post</h2>
          <p className="mt-1 text-sm text-ink-500">AI text, AI photo/video attach, then draft / publish / schedule.</p>

          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Topic / brief</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm"
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
              Tone
              <select value={tone} onChange={(e) => setTone(e.target.value)} className="mt-2 w-full rounded-2xl border border-paper-300 px-4 py-3 text-sm font-normal normal-case tracking-normal">
                {["friendly", "professional", "warm", "concise", "promotional"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
              Post type
              <select value={postType} onChange={(e) => setPostType(e.target.value)} className="mt-2 w-full rounded-2xl border border-paper-300 px-4 py-3 text-sm font-normal normal-case tracking-normal">
                {["STANDARD", "OFFER", "EVENT", "COVID_19"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Post text</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={5}
            placeholder="Write manually or generate with AI…"
            className="mt-2 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm"
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
              CTA
              <select value={ctaType} onChange={(e) => setCtaType(e.target.value)} className="mt-2 w-full rounded-2xl border border-paper-300 px-4 py-3 text-sm font-normal normal-case tracking-normal">
                {["LEARN_MORE", "ORDER", "BOOK", "CALL", "SHOP"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
              CTA URL
              <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className="mt-2 w-full rounded-2xl border border-paper-300 px-4 py-3 text-sm font-normal normal-case tracking-normal" />
            </label>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
              Media type
              <select
                value={postMediaFormat}
                onChange={(e) => setPostMediaFormat(e.target.value as "PHOTO" | "VIDEO")}
                className="mt-2 w-full rounded-2xl border border-paper-300 px-4 py-3 text-sm font-normal normal-case tracking-normal"
              >
                <option value="PHOTO">Photo</option>
                <option value="VIDEO">Video</option>
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
              Schedule at
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-paper-300 px-4 py-3 text-sm font-normal normal-case tracking-normal"
              />
            </label>
          </div>

          <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Media URL (photo or video)</label>
          <input
            value={postMediaUrl}
            onChange={(e) => setPostMediaUrl(e.target.value)}
            placeholder="Paste URL or generate AI photo below"
            className="mt-2 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm"
          />
          {postMediaUrl && postMediaFormat === "PHOTO" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={postMediaUrl} alt="Post media preview" className="mt-3 max-h-40 rounded-2xl object-cover" />
          )}

          {showPostMediaAi && postMediaUrl && (
            <AiFeedback
              key={`post-media-${postMediaAiKey}`}
              busy={loading}
              label="How is this AI post photo?"
              onApprove={() => setNote("Post photo approved — you can still swap the URL before saving.")}
              onRegenerate={() => generateAiImageForPost()}
              onImprove={(notes) => generateAiImageForPost(notes)}
            />
          )}

          {showAiDraft && summary && (
            <AiFeedback
              busy={loading}
              onApprove={() => setNote("Draft approved. Save, publish, or schedule below.")}
              onRegenerate={() => generateAi()}
              onImprove={(notes) => generateAi(notes)}
            />
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => generateAi()} disabled={loading} className="rounded-full bg-leaf-500 px-4 py-2 text-sm font-semibold text-white">
              AI generate text
            </button>
            <button type="button" onClick={() => generateAiImageForPost()} disabled={loading} className="rounded-full border border-leaf-500 px-4 py-2 text-sm font-semibold text-leaf-700">
              AI generate photo
            </button>
            <button type="submit" disabled={loading || !summary.trim()} className="rounded-full border border-paper-300 px-4 py-2 text-sm font-semibold">
              Save draft
            </button>
            <button
              type="button"
              disabled={loading || !summary.trim()}
              onClick={(e) => savePost(e as unknown as FormEvent, "published")}
              className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Publish
            </button>
            <button
              type="button"
              disabled={loading || !summary.trim()}
              onClick={(e) => savePost(e as unknown as FormEvent, "scheduled")}
              className="rounded-full border border-ink-900 px-4 py-2 text-sm font-semibold"
            >
              Schedule
            </button>
          </div>
        </form>

        <form className="surface rounded-[28px] p-6" onSubmit={savePhoto}>
          <h2 className="font-display text-xl font-semibold">Photos</h2>
          <p className="mt-1 text-sm text-ink-500">Upload URL, AI caption, or generate the entire photo with AI.</p>

          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Image URL</label>
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://… or generate with AI"
            className="mt-2 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm"
          />
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Preview" className="mt-3 max-h-40 rounded-2xl object-cover" />
          )}

          <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Category</label>
          <select
            value={photoCategory}
            onChange={(e) => setPhotoCategory(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm"
          >
            {["FOOD_AND_DRINK", "EXTERIOR", "INTERIOR", "ADDITIONAL", "MENU", "TEAMS"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">AI brief (photo + caption)</label>
          <input
            value={photoAiPrompt}
            onChange={(e) => setPhotoAiPrompt(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm"
          />

          <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Caption</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm"
          />

          {showPhotoAi && photoDraftMode === "full" && photoUrl && (
            <AiFeedback
              key={`photo-full-${photoAiKey}`}
              busy={loading}
              label="How is this AI photo + caption?"
              onApprove={() => setNote("Photo approved — edit caption if needed, then Add photo.")}
              onRegenerate={() => generateFullPhoto()}
              onImprove={(notes) => generateFullPhoto(notes)}
            />
          )}

          {showPhotoAi && photoDraftMode === "caption" && caption && (
            <AiFeedback
              key={`photo-caption-${photoAiKey}`}
              busy={loading}
              label="How is this AI caption?"
              onApprove={() => setNote("Caption approved.")}
              onRegenerate={() => generateCaption()}
              onImprove={(notes) => generateCaption(notes)}
            />
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => generateFullPhoto()} disabled={loading} className="rounded-full bg-leaf-500 px-4 py-2 text-sm font-semibold text-white">
              AI generate photo
            </button>
            <button type="button" onClick={() => generateCaption()} disabled={loading} className="rounded-full border border-leaf-500 px-4 py-2 text-sm font-semibold text-leaf-700">
              AI caption only
            </button>
            {photoUrl && (
              <button
                type="button"
                onClick={() => generateFullPhoto()}
                disabled={loading}
                className="rounded-full border border-paper-300 px-4 py-2 text-sm font-semibold"
              >
                {loading ? "Regenerating…" : "Regenerate photo"}
              </button>
            )}
            <button disabled={loading || !photoUrl.trim()} className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white">
              Add photo
            </button>
          </div>
        </form>
      </div>

      <section className="surface mt-4 rounded-[28px] p-6">
        <h2 className="font-display text-xl font-semibold">Auto-schedule from topic list</h2>
        <p className="mt-1 text-sm text-ink-500">
          One topic per line. AI writes each post and spaces them by interval days. Optional AI image per post.
        </p>
        <textarea
          value={batchTopics}
          onChange={(e) => setBatchTopics(e.target.value)}
          rows={5}
          className="mt-4 w-full rounded-2xl border border-paper-300 bg-white px-4 py-3 text-sm"
        />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
            Interval (days)
            <input
              type="number"
              min={1}
              max={14}
              value={batchInterval}
              onChange={(e) => setBatchInterval(Number(e.target.value) || 2)}
              className="mt-2 w-28 rounded-2xl border border-paper-300 px-4 py-3 text-sm font-normal normal-case tracking-normal"
            />
          </label>
          <label className="flex items-center gap-2 rounded-2xl bg-paper-100 px-4 py-3 text-sm">
            <input type="checkbox" checked={batchWithImages} onChange={(e) => setBatchWithImages(e.target.checked)} />
            Attach AI image to each
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={scheduleTopicBatch}
            className="rounded-full bg-ink-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Schedule topic list
          </button>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">Posts</h2>
        <div className="flex flex-wrap gap-2">
          {(["all", "published", "scheduled", "draft"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                statusFilter === key ? "bg-ink-900 text-white" : "border border-paper-300 bg-white text-ink-600"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {posts.map((post) => (
          <article key={post.id} className="surface rounded-[28px] p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">{post.post_type}</p>
              <span className="rounded-full bg-paper-100 px-3 py-1 text-xs font-semibold capitalize text-leaf-700">{post.status}</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-700">{post.summary}</p>
            {post.scheduled_for && (
              <p className="mt-3 text-xs text-ink-400">Scheduled: {new Date(post.scheduled_for).toLocaleString()}</p>
            )}
          </article>
        ))}
        {!posts.length && <p className="text-sm text-ink-400">No posts for this filter.</p>}
      </div>

      <h2 className="mt-8 font-display text-2xl font-semibold">Photos & videos</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {media.map((item) => (
          <article key={item.id} className="surface overflow-hidden rounded-[28px]">
            {item.source_url && item.media_format !== "VIDEO" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.source_url}
                alt={item.caption || item.category || "Photo"}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="grid aspect-square place-items-center bg-paper-100 text-sm text-ink-400">Video</div>
            )}
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
                {item.media_format || "PHOTO"} · {item.category}
              </p>
              {item.caption && <p className="mt-2 text-sm leading-relaxed text-ink-700">{item.caption}</p>}
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-leaf-600">{item.status}</p>
            </div>
          </article>
        ))}
        {!media.length && <p className="text-sm text-ink-400">No media added yet.</p>}
      </div>
    </PageShell>
  );
}
