import {
  Location,
  Media,
  Post,
  Review,
  Store,
  mediaStats,
  postStats,
  reviewStats,
  selectedLocationIds,
} from "../db/store";

export type CheckStatus = "pass" | "warn" | "fail";

export type AuditCheck = {
  id: string;
  status: CheckStatus;
  title: string;
  detail: string;
  pillar: string;
};

export type AuditPillar = {
  id: string;
  label: string;
  weight: number;
  score: number; // 0-100 contribution-ready
  weighted: number; // score * weight/100
  findings: string[];
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function daysSince(iso: string | null | undefined) {
  if (!iso) return 9999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 9999;
  return Math.floor((Date.now() - t) / 86400000);
}

function keywordHit(text: string, words: string[]) {
  const hay = (text || "").toLowerCase();
  return words.some((w) => hay.includes(w.toLowerCase()));
}

function scoreNAP(loc: Location): { score: number; checks: AuditCheck[]; findings: string[] } {
  const checks: AuditCheck[] = [];
  const findings: string[] = [];
  let score = 0;

  const nameHasKeyword = keywordHit(loc.title, ["chinese", "restaurant", "food", "cafe", "hotel"]);
  if (nameHasKeyword || loc.title.length > 3) {
    score += 6;
    checks.push({
      id: "nap-name",
      status: nameHasKeyword ? "pass" : "warn",
      title: nameHasKeyword ? "Business name includes category signal" : "Business name is brand-only",
      detail: nameHasKeyword
        ? `"${loc.title}" includes a discoverable keyword.`
        : "Consider a secondary category / services keywords in description (name can stay brand-led).",
      pillar: "nap",
    });
    if (!nameHasKeyword) findings.push("Name is brand-led — strengthen category keywords in description.");
  } else {
    checks.push({
      id: "nap-name",
      status: "fail",
      title: "Business name missing",
      detail: "Add a clear business title.",
      pillar: "nap",
    });
    findings.push("Business name is incomplete.");
  }

  const addrOk = Boolean(loc.address && loc.address.length > 20 && /\d/.test(loc.address));
  score += addrOk ? 7 : loc.address ? 3 : 0;
  checks.push({
    id: "nap-address",
    status: addrOk ? "pass" : loc.address ? "warn" : "fail",
    title: addrOk ? "Address looks complete" : "Address incomplete",
    detail: loc.address || "No address on profile.",
    pillar: "nap",
  });
  if (!addrOk) findings.push("Address should include street + locality + PIN if possible.");

  const phoneOk = Boolean(loc.phone && loc.phone.replace(/\D/g, "").length >= 10);
  score += phoneOk ? 4 : 0;
  checks.push({
    id: "nap-phone",
    status: phoneOk ? "pass" : "fail",
    title: phoneOk ? "Phone number present" : "Phone number missing",
    detail: loc.phone || "Add a reachable business phone.",
    pillar: "nap",
  });
  if (!phoneOk) findings.push("Phone number missing or invalid.");

  const webOk = Boolean(loc.website && /^https?:\/\//i.test(loc.website));
  score += webOk ? 3 : 0;
  checks.push({
    id: "nap-website",
    status: webOk ? "pass" : "warn",
    title: webOk ? "Website linked" : "Website link missing",
    detail: loc.website || "Add a website or Maps menu link.",
    pillar: "nap",
  });
  if (!webOk) findings.push("Website link is missing.");

  return { score: clamp((score / 20) * 100), checks, findings };
}

function scoreCategories(loc: Location): { score: number; checks: AuditCheck[]; findings: string[] } {
  const checks: AuditCheck[] = [];
  const findings: string[] = [];
  let score = 50;
  const primary = loc.primary_category || "";
  const generic = ["establishment", "point of interest", "business", ""].includes(primary.toLowerCase());
  if (primary && !generic) {
    score = 75;
    checks.push({
      id: "cat-primary",
      status: "pass",
      title: "Primary category looks relevant",
      detail: `Primary: ${primary}`,
      pillar: "categories",
    });
  } else {
    score = 30;
    checks.push({
      id: "cat-primary",
      status: "fail",
      title: "Primary category is missing or too generic",
      detail: "Pick the most specific Google category (e.g. Chinese restaurant).",
      pillar: "categories",
    });
    findings.push("Primary category is too generic or missing.");
  }

  const services = loc.metadata.services || [];
  if (services.length >= 3) {
    score = Math.min(100, score + 25);
    checks.push({
      id: "cat-additional",
      status: "pass",
      title: "Additional services / sub-categories present",
      detail: `${services.length} services listed: ${services.slice(0, 4).join(", ")}`,
      pillar: "categories",
    });
  } else {
    score = Math.max(score - 15, 20);
    checks.push({
      id: "cat-additional",
      status: "warn",
      title: "Add more sub-categories / services",
      detail: "List dishes/services Google can match (Hakka noodles, takeaway, etc.).",
      pillar: "categories",
    });
    findings.push("Additional categories / services are thin.");
  }

  return { score: clamp(score), checks, findings };
}

function scoreReviews(
  reviews: Review[]
): { score: number; checks: AuditCheck[]; findings: string[]; stats: ReturnType<typeof reviewStats> | null } {
  const checks: AuditCheck[] = [];
  const findings: string[] = [];
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.star_rating, 0) / count : 0;
  const answered = reviews.filter((r) => r.is_answered).length;
  const responseRate = count ? answered / count : 0;
  const recentUnanswered = reviews.filter((r) => !r.is_answered && daysSince(r.review_created_at) <= 14).length;

  let score = 0;
  // volume
  if (count >= 25) score += 35;
  else if (count >= 10) score += 28;
  else if (count >= 5) score += 18;
  else if (count > 0) score += 10;
  else findings.push("No reviews yet — ask happy customers to leave Google reviews.");

  checks.push({
    id: "rev-count",
    status: count >= 10 ? "pass" : count >= 5 ? "warn" : "fail",
    title: `${count} Google reviews`,
    detail: count >= 10 ? "Solid review volume for a local listing." : "Aim for 25+ authentic reviews over time.",
    pillar: "reviews",
  });

  // rating
  if (avg >= 4.5) score += 35;
  else if (avg >= 4.0) score += 28;
  else if (avg >= 3.5) score += 18;
  else if (avg > 0) score += 8;
  checks.push({
    id: "rev-avg",
    status: avg >= 4.5 ? "pass" : avg >= 4 ? "warn" : "fail",
    title: `Average rating ${avg ? avg.toFixed(1) : "—"}`,
    detail: avg >= 4.5 ? "Strong rating signal." : "Improve service + reply to negatives to lift average.",
    pillar: "reviews",
  });
  if (avg > 0 && avg < 4.5) findings.push(`Average rating is ${avg.toFixed(1)} — target 4.5+.`);

  // response
  if (responseRate >= 0.9) score += 30;
  else if (responseRate >= 0.7) score += 22;
  else if (responseRate >= 0.4) score += 12;
  else score += 4;
  checks.push({
    id: "rev-response",
    status: responseRate >= 0.85 ? "pass" : responseRate >= 0.5 ? "warn" : "fail",
    title: `Owner response rate ${Math.round(responseRate * 100)}%`,
    detail: `${answered}/${count} reviews have an owner reply.`,
    pillar: "reviews",
  });
  if (responseRate < 0.85) findings.push("Reply to all unanswered reviews, especially low-star ones.");
  if (recentUnanswered > 0) {
    findings.push(`No reply on ${recentUnanswered} review(s) from the last 14 days.`);
    checks.push({
      id: "rev-recent",
      status: "fail",
      title: "Recent reviews unanswered",
      detail: `${recentUnanswered} review(s) in the last 14 days still need a reply.`,
      pillar: "reviews",
    });
  }

  return { score: clamp(score), checks, findings, stats: null };
}

function scorePhotos(media: Media[]): { score: number; checks: AuditCheck[]; findings: string[] } {
  const checks: AuditCheck[] = [];
  const findings: string[] = [];
  const photos = media.filter((m) => (m.media_format || "PHOTO") === "PHOTO");
  const recent = photos.filter((m) => daysSince(m.created_at) <= 30).length;
  const ownerLike = photos.filter((m) => m.category !== "CUSTOMER").length;

  let score = 0;
  if (photos.length >= 25) score += 50;
  else if (photos.length >= 12) score += 35;
  else if (photos.length >= 5) score += 20;
  else if (photos.length > 0) score += 10;

  checks.push({
    id: "photo-count",
    status: photos.length >= 25 ? "pass" : photos.length >= 12 ? "warn" : "fail",
    title: `${photos.length} photos on profile`,
    detail: photos.length >= 25 ? "Healthy photo volume." : "Add at least 25+ photos including geotagged food shots.",
    pillar: "photos",
  });
  if (photos.length < 25) findings.push(`You have only ${photos.length} photos. Add at least 25+ including geotagged images.`);

  if (recent >= 3) score += 25;
  else if (recent >= 1) score += 15;
  else {
    findings.push("No recent photos in the last 30 days.");
  }
  checks.push({
    id: "photo-recent",
    status: recent >= 3 ? "pass" : recent >= 1 ? "warn" : "fail",
    title: recent ? `${recent} photo(s) in last 30 days` : "No recent photo uploads",
    detail: "Fresh visuals improve click-through on Search & Maps.",
    pillar: "photos",
  });

  if (ownerLike >= 3) score += 25;
  else if (ownerLike >= 1) score += 12;
  else findings.push("Add owner-uploaded photos (not only customer photos).");
  checks.push({
    id: "photo-owner",
    status: ownerLike >= 3 ? "pass" : ownerLike >= 1 ? "warn" : "fail",
    title: ownerLike ? "Owner-uploaded visuals present" : "Missing owner-uploaded photos",
    detail: `${ownerLike} owner/media assets vs customer-only uploads.`,
    pillar: "photos",
  });

  return { score: clamp(score), checks, findings };
}

function scoreDescription(loc: Location): { score: number; checks: AuditCheck[]; findings: string[] } {
  const checks: AuditCheck[] = [];
  const findings: string[] = [];
  const desc = loc.description || "";
  const attrs = loc.metadata.attributes || [];
  const services = loc.metadata.services || [];
  const localWords = ["vadjal", "satara", "mhaswad", "near", "takeaway", "chinese", "manchurian", "hakka"];
  const hits = localWords.filter((w) => keywordHit(desc, [w])).length;

  let score = 0;
  if (desc.length >= 250) score += 45;
  else if (desc.length >= 120) score += 30;
  else if (desc.length >= 40) score += 15;
  else findings.push("Business description is too short.");

  if (hits >= 3) score += 30;
  else if (hits >= 1) score += 18;
  else findings.push("Description needs main local keywords (area + dishes).");

  checks.push({
    id: "desc-keywords",
    status: hits >= 3 && desc.length >= 120 ? "pass" : "warn",
    title: hits >= 3 ? "Local keywords present in description" : "Strengthen local keywords",
    detail: desc ? `Description length ${desc.length} chars · keyword hits ${hits}.` : "No description.",
    pillar: "description",
  });

  if (attrs.length >= 3) score += 25;
  else if (attrs.length >= 1) score += 12;
  else findings.push("Fill attributes (amenities, payment, services).");

  checks.push({
    id: "desc-attrs",
    status: attrs.length >= 3 ? "pass" : attrs.length ? "warn" : "fail",
    title: attrs.length >= 3 ? "Attributes filled" : "Attributes incomplete",
    detail: attrs.length ? attrs.join(", ") : "Add amenities / payment methods / services offered.",
    pillar: "description",
  });

  if (services.length) score = Math.min(100, score + 5);

  return { score: clamp(score), checks, findings };
}

function scorePosts(posts: Post[]): { score: number; checks: AuditCheck[]; findings: string[] } {
  const checks: AuditCheck[] = [];
  const findings: string[] = [];
  const published = posts.filter((p) => p.status === "published");
  const scheduled = posts.filter((p) => p.status === "scheduled");
  const lastPub = published
    .map((p) => p.published_at || p.created_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];
  const age = daysSince(lastPub);

  let score = 0;
  if (published.length >= 4) score += 40;
  else if (published.length >= 2) score += 28;
  else if (published.length >= 1) score += 15;

  if (age <= 7) score += 40;
  else if (age <= 21) score += 25;
  else if (age <= 45) score += 12;
  else findings.push("No recent Google Posts — last update is stale.");

  if (scheduled.length >= 1) score += 20;
  else score += 5;

  checks.push({
    id: "posts-activity",
    status: age <= 14 && published.length >= 2 ? "pass" : age <= 30 ? "warn" : "fail",
    title: lastPub ? `Last post ~${age} day(s) ago` : "No published posts",
    detail: `${published.length} published · ${scheduled.length} scheduled`,
    pillar: "posts",
  });
  if (published.length < 2 || age > 14) {
    findings.push("Post regular Offers/Updates (aim weekly).");
  }

  return { score: clamp(score), checks, findings };
}

function labelForScore(total: number) {
  if (total >= 85) return { label: "Excellent", tone: "good" as const };
  if (total >= 70) return { label: "Good", tone: "good" as const };
  if (total >= 55) return { label: "Needs improvement", tone: "warn" as const };
  return { label: "Critical gaps", tone: "bad" as const };
}

function fakeCompetitors(loc: Location, userScore: number) {
  const area = (loc.address || "local area").split(",").slice(-3).join(",").trim() || "nearby";
  const base = [
    {
      name: `${loc.primary_category || "Restaurant"} · ${area.split(",")[0] || "Nearby"} A`,
      score: clamp(userScore + 8 + (userScore % 5), 55, 96),
      edge: "More weekly posts + 40+ food photos",
    },
    {
      name: `Spice Route Kitchen`,
      score: clamp(userScore + 3, 50, 94),
      edge: "Faster review replies (≈95% response)",
    },
    {
      name: `Dragon Bowl Express`,
      score: clamp(userScore - 4, 45, 90),
      edge: "Stronger secondary categories / delivery attributes",
    },
  ];
  return base.map((c) => ({
    ...c,
    gap_vs_you: Math.round((c.score - userScore) * 10) / 10,
    missing_on_yours: c.edge,
  }));
}

export function runProfileAudit(store: Store, tenantId: string, locationId?: string | null) {
  const ids = locationId ? [locationId] : selectedLocationIds(store, tenantId);
  const loc =
    (ids[0] && store.locations.get(ids[0])) ||
    [...store.locations.values()].find((l) => l.tenant_id === tenantId && l.is_selected) ||
    [...store.locations.values()].find((l) => l.tenant_id === tenantId);
  if (!loc || loc.tenant_id !== tenantId) {
    throw new Error("No business location found to audit");
  }

  const reviews = [...store.reviews.values()].filter((r) => r.tenant_id === tenantId && r.location_id === loc.id);
  const posts = [...store.posts.values()].filter((p) => p.tenant_id === tenantId && p.location_id === loc.id);
  const media = [...store.media.values()].filter((m) => m.tenant_id === tenantId && m.location_id === loc.id);

  const nap = scoreNAP(loc);
  const cats = scoreCategories(loc);
  const revs = scoreReviews(reviews);
  const photos = scorePhotos(media);
  const desc = scoreDescription(loc);
  const gposts = scorePosts(posts);

  const pillars: AuditPillar[] = [
    { id: "nap", label: "NAP consistency & completeness", weight: 20, score: nap.score, weighted: 0, findings: nap.findings },
    { id: "categories", label: "Business categories", weight: 15, score: cats.score, weighted: 0, findings: cats.findings },
    { id: "reviews", label: "Google reviews & sentiment", weight: 20, score: revs.score, weighted: 0, findings: revs.findings },
    { id: "photos", label: "Visual content / photos", weight: 15, score: photos.score, weighted: 0, findings: photos.findings },
    { id: "description", label: "Description & attributes", weight: 15, score: desc.score, weighted: 0, findings: desc.findings },
    { id: "posts", label: "Google Posts & activity", weight: 15, score: gposts.score, weighted: 0, findings: gposts.findings },
  ];
  for (const p of pillars) p.weighted = Math.round(((p.score * p.weight) / 100) * 10) / 10;

  const total = Math.round(pillars.reduce((s, p) => s + p.weighted, 0));
  const band = labelForScore(total);
  const checks = [...nap.checks, ...cats.checks, ...revs.checks, ...photos.checks, ...desc.checks, ...gposts.checks];
  const priority = checks.filter((c) => c.status === "fail");
  const recommendations = checks.map((c) => ({
    status: c.status,
    title: c.title,
    detail: c.detail,
    pillar: c.pillar,
  }));

  const rStats = reviewStats(store, tenantId, [loc.id]);
  const pStats = postStats(store, tenantId, [loc.id]);
  const mStats = mediaStats(store, tenantId, [loc.id]);

  return {
    location: {
      id: loc.id,
      title: loc.title,
      address: loc.address,
      primary_category: loc.primary_category,
    },
    overall_score: total,
    max_score: 100,
    label: band.label,
    tone: band.tone,
    note: "Digital Dukan health score from profile completeness signals — not an official Google ranking.",
    source: "demo_local_profile",
    pillars,
    priority_fixes: priority.map((c) => ({
      id: c.id,
      title: c.title,
      detail: c.detail,
      pillar: c.pillar,
    })),
    recommendations,
    checklist: recommendations,
    competitors: fakeCompetitors(loc, total),
    workspace: { ...rStats, ...pStats, ...mStats },
    optimize_path: `/optimizer?location_id=${loc.id}&from=audit`,
    generated_at: new Date().toISOString(),
  };
}
