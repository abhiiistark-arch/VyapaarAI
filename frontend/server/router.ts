import { NextRequest } from "next/server";
import { config, DEMO_EMAIL, DEMO_PASSWORD } from "./config";
import { createAccessToken, hashPassword, requireUser, verifyPassword } from "./core/auth";
import { ApiError, json, pdf, text } from "./core/http";
import { buildReportPdf } from "./services/pdf";
import {
  getStore,
  locationPayload,
  mediaStats,
  newId,
  postStats,
  resolveLocationIds,
  reviewStats,
  seedDemoWorkspace,
  selectedLocationIds,
  type Location,
  type Media,
  type Post,
  type Review,
} from "./db/store";
import { runProfileAudit } from "./services/audit";
import { engagementSummary } from "./services/engagement";
import { GeminiError, generateJson, generateText } from "./services/gemini";
import { generateMarketingImage } from "./services/media";

type Ctx = { user: Awaited<ReturnType<typeof requireUser>>["user"]; membership: Awaited<ReturnType<typeof requireUser>>["membership"] };

function parsePath(parts: string[]) {
  return parts.join("/");
}

async function bodyJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function serializePost(row: Post) {
  return {
    id: row.id,
    location_id: row.location_id,
    post_type: row.post_type,
    summary: row.summary,
    status: row.status,
    cta_type: row.cta_type,
    cta_url: row.cta_url,
    scheduled_for: row.scheduled_for,
    published_at: row.published_at,
    google_post_name: row.google_post_name,
  };
}

function serializeMedia(row: Media) {
  return {
    id: row.id,
    source_url: row.source_url,
    category: row.category,
    caption: row.caption,
    status: row.status,
    location_id: row.location_id,
    post_id: row.post_id,
    media_format: row.media_format || "PHOTO",
  };
}

function parseAutomation(raw: string) {
  let extras: Record<string, unknown> = {};
  let template = raw || "";
  if (raw.startsWith("[[META]]")) {
    try {
      const mid = raw.split("[[META]]")[1].split("[[/META]]")[0];
      extras = JSON.parse(mid);
      template = raw.split("[[/META]]")[1] || "";
    } catch {
      /* keep raw */
    }
  }
  return { extras, template };
}

function writeAutomationTemplate(template: string, extras: Record<string, unknown>) {
  return `[[META]]${JSON.stringify(extras)}[[/META]]${template}`;
}

function getAutomationData(tenantId: string) {
  const store = getStore();
  let rule = store.automation.get(tenantId);
  if (!rule) {
    rule = {
      tenant_id: tenantId,
      enabled: false,
      auto_reply_positive: true,
      require_approval_neutral: true,
      require_approval_negative: true,
      confidence_threshold: 0.7,
      brand_tone: "friendly",
      template_positive: writeAutomationTemplate("Thank you for reviewing {business}!", {
        auto_ai_reply_enabled: false,
        auto_reply_min_rating: 5,
        escalate_keywords: "legal,lawyer,refund,food poisoning,police",
        notify_email: true,
        notify_whatsapp: false,
        schedule_posts_enabled: true,
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
      }),
    };
    store.automation.set(tenantId, rule);
  }
  const { extras, template } = parseAutomation(rule.template_positive);
  return {
    enabled: rule.enabled,
    auto_reply_positive: rule.auto_reply_positive,
    auto_ai_reply_enabled: Boolean(extras.auto_ai_reply_enabled),
    require_approval_neutral: rule.require_approval_neutral,
    require_approval_negative: rule.require_approval_negative,
    confidence_threshold: rule.confidence_threshold,
    brand_tone: rule.brand_tone,
    template_positive: template,
    auto_reply_min_rating: Number(extras.auto_reply_min_rating ?? 5),
    escalate_keywords: String(extras.escalate_keywords ?? "legal,lawyer,refund,food poisoning,police"),
    notify_email: extras.notify_email !== false,
    notify_whatsapp: Boolean(extras.notify_whatsapp),
    schedule_posts_enabled: extras.schedule_posts_enabled !== false,
    quiet_hours_start: String(extras.quiet_hours_start ?? "22:00"),
    quiet_hours_end: String(extras.quiet_hours_end ?? "08:00"),
  };
}

function publishReply(review: Review, reply: string, source: "ai" | "owner" | "demo_seed" = "owner") {
  review.reply_comment = reply;
  review.reply_updated_at = new Date().toISOString();
  review.is_answered = true;
  review.reply_source = source;
  return {
    review_id: review.id,
    reply_comment: reply,
    is_answered: true,
    reply_source: source,
    applied_locally: true,
    pushed_to_google: false,
    note: "Demo mode — reply saved locally (Google publish when live mode is on).",
  };
}

function shouldAutoReply(rule: ReturnType<typeof getAutomationData>, review: Review): [boolean, string] {
  if (!rule.enabled) return [false, "Automation master switch is off"];
  if (!rule.auto_ai_reply_enabled && !rule.auto_reply_positive) return [false, "Auto AI reply is disabled"];
  if (review.is_answered) return [false, "Already answered"];
  const comment = (review.comment || "").toLowerCase();
  for (const word of (rule.escalate_keywords || "").split(",")) {
    const w = word.trim().toLowerCase();
    if (w && comment.includes(w)) return [false, `Escalated keyword: ${w}`];
  }
  const stars = review.star_rating || 0;
  const sentiment = (review.sentiment || "").toLowerCase();
  if ((sentiment === "negative" || stars <= 2) && rule.require_approval_negative) {
    return [false, "Negative reviews require approval"];
  }
  if ((sentiment === "neutral" || stars === 3) && rule.require_approval_neutral) {
    return [false, "Neutral reviews require approval"];
  }
  if (rule.auto_ai_reply_enabled) return [true, "ok"];
  if (rule.auto_reply_positive && stars >= rule.auto_reply_min_rating) return [true, "ok"];
  return [false, "Does not match positive auto-reply rules"];
}

function requireLocation(tenantId: string, locationId: string): Location {
  const loc = getStore().locations.get(locationId);
  if (!loc || loc.tenant_id !== tenantId) throw new ApiError(404, "Location not found");
  return loc;
}

function demoOptimizeFallback(loc: Location, focus: string) {
  return {
    source: "demo_fallback",
    suggestion:
      focus === "description"
        ? `${loc.title} — ${loc.primary_category} in Vadjal serving ${ (loc.metadata.services || []).slice(0, 3).join(", ") || "Indo-Chinese favourites" }. Open ${loc.metadata.hours || "daily"}.`
        : `Improve ${focus} for ${loc.title}: highlight local landmarks, peak hours, and signature dishes.`,
    title: loc.title,
    description: loc.description,
    website: loc.website,
    phone: loc.phone,
    services_text: (loc.metadata.services || []).join(", "),
    attributes_text: (loc.metadata.attributes || []).join(", "),
    hours: loc.metadata.hours,
    primary_category: loc.primary_category,
    rationale: "Fallback copy when Gemini is unavailable.",
  };
}

export async function dispatch(req: NextRequest, parts: string[]) {
  const method = req.method.toUpperCase();
  const path = parsePath(parts);
  const store = getStore();
  const url = new URL(req.url);

  // --- public: system/mode ---
  if (method === "GET" && path === "system/mode") {
    return json({
      app: config.appName,
      demo_mode: config.demoMode,
      use_live_google: config.useLiveGoogle,
      google_live_enabled: config.useLiveGoogle && !config.demoMode,
      gemini_configured: Boolean(config.geminiApiKey),
      switch_instructions: {
        to_live_google: [
          "Set DEMO_MODE=false",
          "Set USE_LIVE_GOOGLE=true",
          "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
          "Confirm GOOGLE_REDIRECT_URI matches Google Cloud console",
          "Redeploy",
        ],
      },
      demo_login: config.demoMode ? { email: DEMO_EMAIL, password: DEMO_PASSWORD } : null,
    });
  }

  // --- auth (public) ---
  if (method === "POST" && path === "auth/register") {
    const payload = await bodyJson(req);
    const email = String(payload.email || "").toLowerCase();
    if ([...store.users.values()].some((u) => u.email === email)) {
      throw new ApiError(400, "Email already registered");
    }
    const userId = newId("usr_");
    const tenantId = newId("ten_");
    const slug =
      String(payload.business_name || "workspace")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "workspace";
    store.users.set(userId, {
      id: userId,
      email,
      hashed_password: await hashPassword(String(payload.password || "")),
      full_name: String(payload.full_name || ""),
      platform_role: "user",
      brand_tone: "friendly",
    });
    store.tenants.set(tenantId, {
      id: tenantId,
      name: String(payload.business_name || "Workspace"),
      slug: `${slug}-${userId.slice(0, 8)}`,
      plan: "starter",
      status: "active",
    });
    const memId = newId("mem_");
    store.memberships.set(memId, {
      id: memId,
      user_id: userId,
      tenant_id: tenantId,
      role: ["owner", "agency_manager", "team_member"].includes(payload.role) ? payload.role : "owner",
      status: "active",
    });
    const token = await createAccessToken(userId, { tenant_id: tenantId });
    return json({ access_token: token, token_type: "bearer" });
  }

  if (method === "POST" && path === "auth/login") {
    const payload = await bodyJson(req);
    const email = String(payload.email || "").toLowerCase();
    // Demo account: re-seed if serverless instance lost in-memory data (no Postgres on Vercel).
    if (email === DEMO_EMAIL) {
      seedDemoWorkspace(store);
    }
    const user = [...store.users.values()].find((u) => u.email === email);
    if (!user || !(await verifyPassword(String(payload.password || ""), user.hashed_password))) {
      throw new ApiError(401, "Invalid email or password");
    }
    const membership = [...store.memberships.values()].find(
      (m) => m.user_id === user.id && m.status === "active"
    );
    const token = await createAccessToken(user.id, membership ? { tenant_id: membership.tenant_id } : {});
    return json({ access_token: token, token_type: "bearer" });
  }

  // Everything below requires auth
  const auth = await requireUser(req);
  const ctx: Ctx = { user: auth.user, membership: auth.membership };
  const tenantId = ctx.membership.tenant_id;

  if (method === "GET" && path === "auth/me") {
    const tenant = store.tenants.get(tenantId);
    const connected = [...store.connections.values()].some(
      (c) => c.tenant_id === tenantId && c.status === "connected"
    );
    const selected = [...store.locations.values()].filter((l) => l.tenant_id === tenantId && l.is_selected).length;
    return json({
      user: {
        id: ctx.user.id,
        email: ctx.user.email,
        full_name: ctx.user.full_name,
        platform_role: ctx.user.platform_role,
        brand_tone: ctx.user.brand_tone,
      },
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            plan: tenant.plan,
            status: tenant.status,
            role: ctx.membership.role,
          }
        : null,
      google_connected: connected || config.demoMode,
      selected_location_count: selected,
    });
  }

  if (method === "POST" && path === "system/seed-demo") {
    if (!config.demoMode) return json({ ok: false, message: "DEMO_MODE is off — seed skipped" });
    return json(seedDemoWorkspace(store));
  }

  // --- dashboard ---
  if (method === "GET" && path === "dashboard/overview") {
    const days = Number(url.searchParams.get("days") || 30);
    const start_date = url.searchParams.get("start_date");
    const end_date = url.searchParams.get("end_date");
    const connection = [...store.connections.values()].find((c) => c.tenant_id === tenantId);
    const locationIds = selectedLocationIds(store, tenantId);
    const engagement = engagementSummary(store, tenantId, locationIds, {
      days,
      start_date,
      end_date,
    });
    const reviews = reviewStats(store, tenantId, locationIds);
    const posts = postStats(store, tenantId, locationIds);
    const media = mediaStats(store, tenantId, locationIds);
    const tasks = [...store.tasks.values()]
      .filter((t) => t.tenant_id === tenantId && t.status === "open")
      .sort((a, b) => a.sort_order - b.sort_order)
      .slice(0, 8);
    const locations = [...store.locations.values()]
      .filter((l) => l.tenant_id === tenantId)
      .sort((a, b) => a.title.localeCompare(b.title));
    let profileCompleteness = {
      percent: 0,
      label: "Needs improvement",
      tone: "warn" as string,
      pillars: [] as Array<{ id: string; label: string; weight: number; score: number; weighted: number }>,
    };
    try {
      const audit = runProfileAudit(store, tenantId, locationIds[0] || null);
      profileCompleteness = {
        percent: audit.overall_score,
        label: audit.label,
        tone: audit.tone,
        pillars: audit.pillars.map((p) => ({
          id: p.id,
          label: p.label,
          weight: p.weight,
          score: p.score,
          weighted: p.weighted,
        })),
      };
    } catch {
      /* no location yet */
    }
    return json({
      connection: {
        status: connection?.status || "disconnected",
        google_email: connection?.google_email || null,
        last_synced_at: connection?.last_synced_at || null,
        last_error: connection?.last_error || null,
      },
      engagement,
      profile_completeness: profileCompleteness,
      stats: {
        businesses: [...store.accounts.values()].filter((a) => a.tenant_id === tenantId).length,
        locations: locationIds.length,
        reviews: reviews.reviews,
        average_rating: reviews.average_rating,
        unanswered_reviews: reviews.unanswered_reviews,
        total_posts: posts.total_posts,
        published_posts: posts.published_posts,
        scheduled_posts: posts.scheduled_posts,
        draft_posts: posts.draft_posts,
        pending_sync_posts: posts.pending_sync_posts,
        photos: media.photos,
        videos: media.videos,
        pending_tasks: tasks.length,
      },
      scope: {
        location_ids: locationIds,
        note: "Stats use the same selected-location scope as Posts & Reviews.",
        engagement_start: engagement.start_date,
        engagement_end: engagement.end_date,
      },
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        expected_benefit: t.expected_benefit,
      })),
      locations: locations.map((l) => ({
        id: l.id,
        title: l.title,
        address: l.address,
        primary_category: l.primary_category,
        is_selected: l.is_selected,
      })),
    });
  }

  if (method === "GET" && (path === "audit" || path === "audit/run")) {
    const locationId = url.searchParams.get("location_id");
    try {
      return json(runProfileAudit(store, tenantId, locationId));
    } catch (err) {
      throw new ApiError(404, err instanceof Error ? err.message : "Audit failed");
    }
  }

  if (method === "POST" && path === "audit/run") {
    const payload = await bodyJson(req);
    try {
      return json(runProfileAudit(store, tenantId, payload.location_id || null));
    } catch (err) {
      throw new ApiError(404, err instanceof Error ? err.message : "Audit failed");
    }
  }

  // --- google ---
  if (method === "GET" && path === "google/connect") {
    return json({
      permissions_url: "",
      configured: false,
      message:
        "Demo mode is on — sample business data is loaded locally for testing. When Google approves GBP APIs, set DEMO_MODE=false, USE_LIVE_GOOGLE=true, and add Google OAuth secrets.",
    });
  }

  if (method === "GET" && path === "google/locations") {
    return json(
      [...store.locations.values()]
        .filter((l) => l.tenant_id === tenantId)
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(locationPayload)
    );
  }

  if (method === "POST" && path === "google/locations/select") {
    const payload = await bodyJson(req);
    const selected = new Set<string>(payload.location_ids || []);
    for (const loc of store.locations.values()) {
      if (loc.tenant_id === tenantId) loc.is_selected = selected.has(loc.id);
    }
    return json({ selected: selected.size });
  }

  if (method === "POST" && path === "google/disconnect") {
    const connection = [...store.connections.values()].find((c) => c.tenant_id === tenantId);
    if (connection) connection.status = "revoked";
    return json({ status: "revoked" });
  }

  if (method === "POST" && path === "google/sync") {
    throw new ApiError(400, "Google Business Profile is not connected (demo mode)");
  }

  // --- reviews ---
  if (method === "GET" && path === "reviews") {
    const locationIds = resolveLocationIds(store, tenantId, url.searchParams.get("location_id"));
    const start_date = url.searchParams.get("start_date");
    const end_date = url.searchParams.get("end_date");
    let rows = [...store.reviews.values()].filter(
      (r) => r.tenant_id === tenantId && (!locationIds.length || locationIds.includes(r.location_id))
    );
    if (start_date) rows = rows.filter((r) => (r.review_created_at || "").slice(0, 10) >= start_date);
    if (end_date) rows = rows.filter((r) => (r.review_created_at || "").slice(0, 10) <= end_date);
    const sentiment = url.searchParams.get("sentiment");
    const answered = url.searchParams.get("answered");
    const minRating = url.searchParams.get("min_rating");
    if (sentiment) rows = rows.filter((r) => r.sentiment === sentiment);
    if (answered != null) rows = rows.filter((r) => r.is_answered === (answered === "true"));
    if (minRating) rows = rows.filter((r) => r.star_rating >= Number(minRating));
    rows.sort((a, b) => (b.review_created_at || "").localeCompare(a.review_created_at || ""));
    return json({
      items: rows.map((r) => ({
        id: r.id,
        reviewer_name: r.reviewer_name,
        star_rating: r.star_rating,
        comment: r.comment,
        review_created_at: r.review_created_at,
        reply_comment: r.reply_comment,
        is_answered: r.is_answered,
        sentiment: r.sentiment,
        reply_source: r.reply_source || (r.reply_comment ? "demo_seed" : null),
        location_id: r.location_id,
      })),
      stats: reviewStats(store, tenantId, locationIds, { start_date, end_date }),
      scope: { location_ids: locationIds, start_date, end_date },
    });
  }

  if (method === "POST" && path === "reviews/generate-reply") {
    const payload = await bodyJson(req);
    const review = store.reviews.get(String(payload.review_id || ""));
    if (!review || review.tenant_id !== tenantId) throw new ApiError(404, "Review not found");
    const loc = store.locations.get(review.location_id);
    try {
      const data = await generateJson(
        `Write a ${payload.tone || "friendly"} Google review reply for ${loc?.title || "this business"} (${loc?.primary_category || "local business"}).
Stars: ${review.star_rating}
Review: ${review.comment}
Existing reply: ${review.reply_comment || "none"}
Return JSON {"reply":"...","tone":"..."}`,
        '{"reply":"","tone":"friendly"}'
      );
      return json({ draft_id: newId("draft_"), ...data });
    } catch (err) {
      const fallback = `Thank you for sharing your feedback${review.star_rating >= 4 ? "!" : ". We're sorry it wasn't perfect and we'd love another chance."} — ${loc?.title || "the team"}`;
      return json({
        draft_id: newId("draft_"),
        reply: fallback,
        tone: payload.tone || "friendly",
        gemini_error: err instanceof Error ? err.message.slice(0, 200) : undefined,
      });
    }
  }

  if (method === "POST" && path === "reviews/reply") {
    const payload = await bodyJson(req);
    const review = store.reviews.get(String(payload.review_id || ""));
    if (!review || review.tenant_id !== tenantId) throw new ApiError(404, "Review not found");
    const reply = String(payload.reply || "");
    if (reply.length < 2) throw new ApiError(400, "Reply too short");
    const source = payload.source === "ai" ? "ai" : "owner";
    if (!payload.publish) {
      review.reply_comment = reply;
      review.reply_updated_at = new Date().toISOString();
      review.reply_source = source;
      return json({
        review_id: review.id,
        reply_comment: reply,
        is_answered: review.is_answered,
        reply_source: source,
        applied_locally: true,
        pushed_to_google: false,
        note: "Reply saved as editable draft.",
      });
    }
    return json(publishReply(review, reply, source));
  }

  // --- posts ---
  if (method === "GET" && path === "posts") {
    const locationIds = resolveLocationIds(store, tenantId, url.searchParams.get("location_id"));
    let rows = [...store.posts.values()].filter(
      (p) => p.tenant_id === tenantId && (!locationIds.length || locationIds.includes(p.location_id))
    );
    const status = url.searchParams.get("status");
    if (status) rows = rows.filter((p) => p.status === status);
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return json({
      items: rows.map(serializePost),
      stats: postStats(store, tenantId, locationIds),
      scope: { location_ids: locationIds },
    });
  }

  if (method === "GET" && path === "posts/media") {
    const locationIds = resolveLocationIds(store, tenantId, url.searchParams.get("location_id"));
    const rows = [...store.media.values()]
      .filter((m) => m.tenant_id === tenantId && (!locationIds.length || locationIds.includes(m.location_id)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return json({
      items: rows.map(serializeMedia),
      stats: mediaStats(store, tenantId, locationIds),
      scope: { location_ids: locationIds },
    });
  }

  if (method === "POST" && path === "posts/generate") {
    const payload = await bodyJson(req);
    const loc = requireLocation(tenantId, String(payload.location_id));
    const mode = payload.mode || "post";
    try {
      if (mode === "caption") {
        const data = await generateJson(
          `Write a short GBP photo caption for ${loc.title}. Topic: ${payload.topic || "signature dish"}. Tone: ${payload.tone || "friendly"}. Return {"caption":"...","summary":"..."}`,
          '{"caption":"","summary":""}'
        );
        if (!data.summary) data.summary = data.caption || "";
        return json(data);
      }
      const data = await generateJson(
        `Write a Google Business local post for ${loc.title} (${loc.primary_category}) in ${loc.address}.
Topic: ${payload.topic || "weekly special"}
Tone: ${payload.tone || "friendly"}
Services: ${(loc.metadata.services || []).join(", ")}
Return {"summary":"...","cta_type":"LEARN_MORE","hashtags":[]}`,
        '{"summary":"","cta_type":"LEARN_MORE","hashtags":[]}'
      );
      return json(data);
    } catch (err) {
      const summary = `${payload.topic || "Visit us"} at ${loc.title} — ${(loc.metadata.services || [])[0] || "fresh favourites"} near you. Open ${loc.metadata.hours || "today"}!`;
      return json({
        summary,
        caption: summary,
        cta_type: "LEARN_MORE",
        gemini_error: err instanceof Error ? err.message.slice(0, 200) : undefined,
      });
    }
  }

  if (method === "POST" && path === "posts" && parts.length === 1) {
    const payload = await bodyJson(req);
    const loc = requireLocation(tenantId, String(payload.location_id));
    let status = String(payload.status || "draft");
    let scheduled_for: string | null = null;
    if (payload.scheduled_for) {
      scheduled_for = new Date(payload.scheduled_for).toISOString();
      status = "scheduled";
    }
    const postId = newId("post_");
    const post: Post = {
      id: postId,
      tenant_id: tenantId,
      location_id: loc.id,
      google_post_name: null,
      post_type: String(payload.post_type || "STANDARD"),
      summary: String(payload.summary || ""),
      cta_type: payload.cta_type || "LEARN_MORE",
      cta_url: payload.cta_url || loc.website,
      status,
      scheduled_for,
      published_at: status === "published" ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
    };
    store.posts.set(postId, post);
    const result: Record<string, unknown> = {
      post: serializePost(post),
      note: "Saved in demo store. Publishes to Google when live mode is enabled.",
      stats: postStats(store, tenantId, [loc.id]),
    };
    if (payload.media_url) {
      const mid = newId("media_");
      const media: Media = {
        id: mid,
        tenant_id: tenantId,
        location_id: loc.id,
        post_id: postId,
        source_url: String(payload.media_url),
        category: "ADDITIONAL",
        caption: "",
        media_format: String(payload.media_format || "PHOTO"),
        status: "ready",
        created_at: new Date().toISOString(),
      };
      store.media.set(mid, media);
      result.media = serializeMedia(media);
    }
    return json(result);
  }

  if (method === "POST" && path === "posts/media") {
    const payload = await bodyJson(req);
    const loc = requireLocation(tenantId, String(payload.location_id));
    const mid = newId("media_");
    const media: Media = {
      id: mid,
      tenant_id: tenantId,
      location_id: loc.id,
      post_id: payload.post_id || null,
      source_url: String(payload.source_url || ""),
      category: String(payload.category || "ADDITIONAL"),
      caption: String(payload.caption || ""),
      media_format: String(payload.media_format || "PHOTO"),
      status: "ready",
      created_at: new Date().toISOString(),
    };
    store.media.set(mid, media);
    return json({
      media: serializeMedia(media),
      note: "Media saved locally (demo).",
      stats: mediaStats(store, tenantId, [loc.id]),
    });
  }

  if (method === "POST" && path === "posts/media/generate") {
    const payload = await bodyJson(req);
    const loc = requireLocation(tenantId, String(payload.location_id));
    const generated = await generateMarketingImage(loc, {
      brief: payload.brief,
      category: payload.category,
      style: payload.style,
    });
    let saved = null;
    if (payload.save !== false && generated.source_url) {
      const mid = newId("media_");
      const media: Media = {
        id: mid,
        tenant_id: tenantId,
        location_id: loc.id,
        post_id: null,
        source_url: generated.source_url,
        category: String(payload.category || "ADDITIONAL"),
        caption: generated.caption || "",
        media_format: "PHOTO",
        status: "ready",
        created_at: new Date().toISOString(),
      };
      store.media.set(mid, media);
      saved = serializeMedia(media);
    }
    return json({
      ...generated,
      media: saved,
      note:
        generated.note ||
        (generated.generation_source === "gemini_image"
          ? "Photorealistic AI image ready."
          : generated.generation_source === "photorealistic_fallback"
            ? "Photorealistic image ready (alternate engine)."
            : "Placeholder visual — retry for a photo."),
    });
  }

  if (method === "POST" && path === "posts/schedule-batch") {
    const payload = await bodyJson(req);
    const loc = requireLocation(tenantId, String(payload.location_id));
    let cursor = payload.start_at
      ? new Date(payload.start_at)
      : (() => {
          const d = new Date();
          d.setUTCHours(10, 0, 0, 0);
          if (d <= new Date()) d.setUTCDate(d.getUTCDate() + 1);
          return d;
        })();
    const interval = Math.min(14, Math.max(1, Number(payload.interval_days || 2)));
    const created: Array<Record<string, unknown>> = [];
    for (const topicRaw of payload.topics || []) {
      const topic = String(topicRaw || "").trim();
      if (!topic) continue;
      let summary = topic;
      if (payload.generate_ai_copy !== false) {
        try {
          const data = await generateJson(
            `Local post for ${loc.title}. Topic: ${topic}. Tone: ${payload.tone || "friendly"}. Return {"summary":"..."}`,
            '{"summary":""}'
          );
          summary = String(data.summary || topic);
        } catch {
          summary = `${topic} — visit ${loc.title}.`;
        }
      }
      let media_url: string | null = null;
      if (payload.attach_ai_image) {
        try {
          const gen = await generateMarketingImage(loc, { brief: topic });
          media_url = gen.source_url;
        } catch {
          media_url = null;
        }
      }
      const postId = newId("post_");
      store.posts.set(postId, {
        id: postId,
        tenant_id: tenantId,
        location_id: loc.id,
        google_post_name: null,
        post_type: "STANDARD",
        summary,
        cta_type: "LEARN_MORE",
        cta_url: loc.website,
        status: "scheduled",
        scheduled_for: cursor.toISOString(),
        published_at: null,
        created_at: new Date().toISOString(),
      });
      if (media_url) {
        const mid = newId("media_");
        store.media.set(mid, {
          id: mid,
          tenant_id: tenantId,
          location_id: loc.id,
          post_id: postId,
          source_url: media_url,
          category: "ADDITIONAL",
          caption: topic,
          media_format: "PHOTO",
          status: "ready",
          created_at: new Date().toISOString(),
        });
      }
      created.push({
        post_id: postId,
        topic,
        summary,
        scheduled_for: cursor.toISOString(),
        media_url,
      });
      cursor = new Date(cursor.getTime() + interval * 86400000);
    }
    return json({
      created,
      count: created.length,
      stats: postStats(store, tenantId, [loc.id]),
      note: `Scheduled ${created.length} post(s). They publish when Google live mode is on (demo keeps them as scheduled).`,
    });
  }

  // --- analytics ---
  if (method === "GET" && path === "analytics") {
    const days = Math.min(90, Math.max(7, Number(url.searchParams.get("days") || 30)));
    const locationIds = selectedLocationIds(store, tenantId);
    const engagement = engagementSummary(store, tenantId, locationIds, { days });
    const reviews = reviewStats(store, tenantId, locationIds);
    const posts = postStats(store, tenantId, locationIds);
    const media = mediaStats(store, tenantId, locationIds);
    const reports = [...store.reports.values()]
      .filter((r) => r.tenant_id === tenantId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10);
    return json({
      engagement,
      workspace: { ...reviews, ...posts, ...media },
      reports: reports.map((r) => ({
        id: r.id,
        title: r.title,
        period_label: r.period_label,
        status: r.status,
        created_at: r.created_at,
      })),
      scope: { location_ids: locationIds },
      note: "Demo metrics until USE_LIVE_GOOGLE=true.",
    });
  }

  if (method === "POST" && path === "analytics/reports") {
    const days = Math.min(90, Math.max(7, Number(url.searchParams.get("days") || 30)));
    const locationIds = selectedLocationIds(store, tenantId);
    const engagement = engagementSummary(store, tenantId, locationIds, { days });
    const reviews = reviewStats(store, tenantId, locationIds);
    const posts = postStats(store, tenantId, locationIds);
    const media = mediaStats(store, tenantId, locationIds);
    const loc = locationIds.length ? store.locations.get(locationIds[0]) : null;
    const reportId = newId("rpt_");
    const body = {
      generated_at: new Date().toISOString(),
      business: loc?.title || null,
      engagement,
      reviews,
      posts,
      media,
    };
    store.reports.set(reportId, {
      id: reportId,
      tenant_id: tenantId,
      location_id: locationIds[0] || null,
      title: `${loc?.title || "Workspace"} performance report`,
      period_label: `Last ${days} days (${engagement.start_date} → ${engagement.end_date})`,
      status: "ready",
      summary_json: JSON.stringify(body),
      created_at: new Date().toISOString(),
    });
    return json({
      id: reportId,
      title: store.reports.get(reportId)!.title,
      period_label: store.reports.get(reportId)!.period_label,
      status: "ready",
      download_path: `/api/v1/analytics/reports/${reportId}/download`,
    });
  }

  const downloadMatch = path.match(/^analytics\/reports\/([^/]+)\/download$/);
  if (method === "GET" && downloadMatch) {
    const report = store.reports.get(downloadMatch[1]);
    if (!report || report.tenant_id !== tenantId || !report.summary_json) {
      return text("Report not found", 404);
    }
    const data = JSON.parse(report.summary_json);
    const eng = data.engagement || {};
    const reviews = data.reviews || {};
    const posts = data.posts || {};
    const lines = [
      report.period_label,
      "",
      "== User engagement ==",
      `Profile views: ${eng.profile_views}`,
      `Search views: ${eng.search_views} | Maps views: ${eng.maps_views}`,
      `Website clicks: ${eng.website_clicks}`,
      `Call clicks: ${eng.call_clicks}`,
      `Direction requests: ${eng.direction_requests}`,
      `Messages: ${eng.message_clicks} | Menu clicks: ${eng.menu_clicks} | Bookings: ${eng.bookings}`,
      `Total actions: ${eng.total_actions} | Action rate: ${eng.conversion_rate_pct}%`,
      "",
      "== Workspace ==",
      `Reviews: ${reviews.reviews} (unanswered ${reviews.unanswered_reviews})`,
      `Avg rating: ${reviews.average_rating}`,
      `Posts: ${posts.total_posts} total / ${posts.published_posts} published`,
      `Photos: ${data.media?.photos ?? 0} | Videos: ${data.media?.videos ?? 0}`,
    ];
    const filename = `digital-dukan-report-${report.id.slice(0, 8)}.pdf`;
    const bytes = await buildReportPdf({
      title: report.title,
      lines,
      footer: "Generated by Digital Dukan · Google Business Profile Performance metrics",
    });
    return pdf(bytes, filename);
  }

  // --- automation ---
  if (method === "GET" && path === "automation") {
    return json(getAutomationData(tenantId));
  }

  if (method === "PUT" && path === "automation") {
    const payload = await bodyJson(req);
    const current = getAutomationData(tenantId);
    const rule = store.automation.get(tenantId)!;
    if (payload.enabled != null) rule.enabled = Boolean(payload.enabled);
    if (payload.auto_reply_positive != null) rule.auto_reply_positive = Boolean(payload.auto_reply_positive);
    if (payload.require_approval_neutral != null)
      rule.require_approval_neutral = Boolean(payload.require_approval_neutral);
    if (payload.require_approval_negative != null)
      rule.require_approval_negative = Boolean(payload.require_approval_negative);
    if (payload.confidence_threshold != null) rule.confidence_threshold = Number(payload.confidence_threshold);
    if (payload.brand_tone != null) rule.brand_tone = String(payload.brand_tone);
    const extras = {
      auto_ai_reply_enabled:
        payload.auto_ai_reply_enabled != null ? Boolean(payload.auto_ai_reply_enabled) : current.auto_ai_reply_enabled,
      auto_reply_min_rating:
        payload.auto_reply_min_rating != null ? Number(payload.auto_reply_min_rating) : current.auto_reply_min_rating,
      escalate_keywords:
        payload.escalate_keywords != null ? String(payload.escalate_keywords) : current.escalate_keywords,
      notify_email: payload.notify_email != null ? Boolean(payload.notify_email) : current.notify_email,
      notify_whatsapp: payload.notify_whatsapp != null ? Boolean(payload.notify_whatsapp) : current.notify_whatsapp,
      schedule_posts_enabled:
        payload.schedule_posts_enabled != null
          ? Boolean(payload.schedule_posts_enabled)
          : current.schedule_posts_enabled,
      quiet_hours_start:
        payload.quiet_hours_start != null ? String(payload.quiet_hours_start) : current.quiet_hours_start,
      quiet_hours_end: payload.quiet_hours_end != null ? String(payload.quiet_hours_end) : current.quiet_hours_end,
    };
    const template =
      payload.template_positive != null ? String(payload.template_positive) : current.template_positive;
    rule.template_positive = writeAutomationTemplate(template, extras);
    return json(getAutomationData(tenantId));
  }

  if (method === "POST" && path === "automation/run-review-replies") {
    const ruleData = getAutomationData(tenantId);
    if (!ruleData.enabled) throw new ApiError(400, "Turn on Enable automation first");
    if (!ruleData.auto_ai_reply_enabled && !ruleData.auto_reply_positive) {
      throw new ApiError(400, "Enable Auto AI review replies (or positive auto-reply)");
    }
    const locationIds = resolveLocationIds(store, tenantId);
    const unanswered = [...store.reviews.values()]
      .filter(
        (r) =>
          r.tenant_id === tenantId &&
          !r.is_answered &&
          (!locationIds.length || locationIds.includes(r.location_id))
      )
      .sort((a, b) => b.review_created_at.localeCompare(a.review_created_at))
      .slice(0, 25);
    const results: Array<Record<string, unknown>> = [];
    for (const review of unanswered) {
      const [ok, reason] = shouldAutoReply(ruleData, review);
      if (!ok) {
        results.push({ review_id: review.id, status: "skipped", reason });
        continue;
      }
      const loc = store.locations.get(review.location_id);
      let reply: string | null = null;
      if (ruleData.auto_ai_reply_enabled) {
        try {
          const data = await generateJson(
            `Write a ${ruleData.brand_tone} reply for ${loc?.title || "business"}. Stars ${review.star_rating}. Review: ${review.comment}. Return {"reply":"..."}`,
            '{"reply":""}'
          );
          reply = String(data.reply || "");
        } catch (err) {
          results.push({
            review_id: review.id,
            status: "error",
            reason: err instanceof Error ? err.message : String(err),
          });
          continue;
        }
      }
      if (!reply) {
        reply = (ruleData.template_positive || "Thank you for your review!").replace(
          "{business}",
          loc?.title || "us"
        );
      }
      publishReply(review, reply);
      results.push({
        review_id: review.id,
        status: "replied",
        reply,
        at: new Date().toISOString(),
      });
    }
    const replied = results.filter((r) => r.status === "replied").length;
    return json({
      processed: results.length,
      replied,
      skipped: results.filter((r) => r.status === "skipped").length,
      results,
      note: `Auto-replied to ${replied} review(s) using current automation rules.`,
    });
  }

  // --- profile ---
  if (method === "GET" && path === "profile/detail") {
    const locationId = url.searchParams.get("location_id");
    let loc = locationId
      ? store.locations.get(locationId)
      : [...store.locations.values()].find((l) => l.tenant_id === tenantId && l.is_selected);
    if (!loc || loc.tenant_id !== tenantId) {
      loc = [...store.locations.values()].find((l) => l.tenant_id === tenantId);
    }
    if (!loc) throw new ApiError(404, "No business found in this workspace.");
    return json(locationPayload(loc));
  }

  if (method === "POST" && path === "profile/optimize") {
    const payload = await bodyJson(req);
    const loc = requireLocation(tenantId, String(payload.location_id));
    try {
      const data = await generateJson(
        `Optimize GBP ${payload.focus || "description"} for ${loc.title}. Notes: ${payload.notes || ""}.
Current description: ${loc.description}
Return JSON with suggestion, description, title, website, phone, services_text, attributes_text, hours, primary_category, rationale`,
        '{"suggestion":"","description":"","rationale":""}'
      );
      return json({
        location_id: loc.id,
        focus: payload.focus,
        profile: locationPayload(loc),
        source: "gemini",
        ...data,
      });
    } catch (err) {
      const data = demoOptimizeFallback(loc, String(payload.focus || "description"));
      return json({
        location_id: loc.id,
        focus: payload.focus,
        profile: locationPayload(loc),
        ...data,
        gemini_error: err instanceof GeminiError ? err.message.slice(0, 240) : undefined,
      });
    }
  }

  if (method === "POST" && path === "profile/apply") {
    const payload = await bodyJson(req);
    const loc = requireLocation(tenantId, String(payload.location_id));
    if (payload.services_text != null) {
      loc.metadata.services = String(payload.services_text)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (payload.attributes_text != null) {
      loc.metadata.attributes = String(payload.attributes_text)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (payload.hours != null) loc.metadata.hours = String(payload.hours);
    if (payload.primary_category != null) loc.primary_category = String(payload.primary_category);
    if (payload.description != null) loc.description = String(payload.description);
    if (payload.website != null) loc.website = String(payload.website);
    if (payload.phone != null) loc.phone = String(payload.phone);
    if (payload.title != null) loc.title = String(payload.title);
    return json({
      note: "Profile updated locally (demo). Syncs to Google when live mode is on.",
      profile: locationPayload(loc),
      applied_locally: true,
      pushed_to_google: false,
    });
  }

  if (method === "POST" && path === "profile/businesses") {
    const payload = await bodyJson(req);
    let account = [...store.accounts.values()].find((a) => a.tenant_id === tenantId);
    if (!account) {
      const accountId = newId("acc_");
      account = { id: accountId, tenant_id: tenantId, display_name: String(payload.title || "Business") };
      store.accounts.set(accountId, account);
      store.connections.set(newId("gcon_"), {
        id: newId("gcon_"),
        tenant_id: tenantId,
        google_email: "manual@digitaldukan.demo",
        status: "demo_manual",
        last_synced_at: null,
        last_error: null,
      });
    }
    const locId = newId("loc_");
    const loc: Location = {
      id: locId,
      tenant_id: tenantId,
      account_id: account.id,
      title: String(payload.title || "Business"),
      address: String(payload.address || ""),
      phone: String(payload.phone || ""),
      website: String(payload.website || ""),
      primary_category: String(payload.primary_category || "Restaurant"),
      description: String(payload.description || ""),
      is_selected: true,
      sync_status: "manual_demo",
      metadata: { hours: "11:00 AM – 10:30 PM", services: [], attributes: ["Takeaway"] },
    };
    store.locations.set(locId, loc);
    return json({
      ...locationPayload(loc),
      note: "Saved in Digital Dukan. Link to a real Google location after GBP API approval.",
    });
  }

  // --- ai ---
  if (method === "POST" && path === "ai/assistant") {
    const payload = await bodyJson(req);
    let locations = [...store.locations.values()].filter((l) => l.tenant_id === tenantId);
    if (payload.location_id) locations = locations.filter((l) => l.id === payload.location_id);
    else {
      const selected = locations.filter((l) => l.is_selected);
      if (selected.length) locations = selected;
    }
    const context =
      locations
        .map(
          (row) =>
            `- ${row.title} | category=${row.primary_category} | address=${row.address} | phone=${row.phone}`
        )
        .join("\n") || "No locations available yet.";
    try {
      const answer = await generateText(
        `Locations:\n${context}\n\nUser: ${payload.message}\nGive a short helpful answer about Google Business Profile growth.`
      );
      return json({ reply: answer, requires_confirmation: true });
    } catch (err) {
      return json({
        reply: `For ${locations[0]?.title || "your business"}, focus on unanswered reviews, weekly posts, and fresh food photos. (Gemini unavailable: ${err instanceof Error ? err.message.slice(0, 120) : "error"})`,
        requires_confirmation: true,
      });
    }
  }

  if (method === "POST" && path === "ai/description") {
    const payload = await bodyJson(req);
    const loc = requireLocation(tenantId, String(payload.location_id));
    try {
      return json(
        await generateJson(
          `Write a GBP description for ${loc.title}. Notes: ${payload.extra_notes || ""}. Return {"description":"...","seo_keywords":[]}`,
          '{"description":"","seo_keywords":[]}'
        )
      );
    } catch {
      return json({
        description: loc.description || `${loc.title} — local ${loc.primary_category}.`,
        seo_keywords: ["near me", loc.primary_category],
      });
    }
  }

  throw new ApiError(404, `No route for ${method} /api/v1/${path}`);
}
