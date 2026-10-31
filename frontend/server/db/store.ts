import bcrypt from "bcryptjs";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../config";

export type User = {
  id: string;
  email: string;
  hashed_password: string;
  full_name: string;
  platform_role: string;
  brand_tone: string;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
};

export type Membership = {
  id: string;
  user_id: string;
  tenant_id: string;
  role: string;
  status: string;
};

export type Location = {
  id: string;
  tenant_id: string;
  account_id: string;
  title: string;
  address: string;
  phone: string;
  website: string;
  primary_category: string;
  description: string;
  is_selected: boolean;
  sync_status: string;
  metadata: {
    hours?: string;
    services?: string[];
    attributes?: string[];
    source?: string;
  };
};

export type Review = {
  id: string;
  tenant_id: string;
  location_id: string;
  reviewer_name: string;
  star_rating: number;
  comment: string;
  review_created_at: string;
  reply_comment: string | null;
  reply_updated_at: string | null;
  is_answered: boolean;
  sentiment: string;
};

export type Post = {
  id: string;
  tenant_id: string;
  location_id: string;
  google_post_name: string | null;
  post_type: string;
  summary: string;
  cta_type: string | null;
  cta_url: string | null;
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
};

export type Media = {
  id: string;
  tenant_id: string;
  location_id: string;
  post_id: string | null;
  source_url: string;
  category: string;
  caption: string;
  media_format: string;
  status: string;
  created_at: string;
};

export type Task = {
  id: string;
  tenant_id: string;
  location_id: string;
  title: string;
  description: string;
  priority: string;
  expected_benefit: string;
  status: string;
  sort_order: number;
};

export type Metric = {
  tenant_id: string;
  location_id: string;
  metric_date: string;
  metric_name: string;
  metric_value: number;
};

export type Report = {
  id: string;
  tenant_id: string;
  location_id: string | null;
  title: string;
  period_label: string;
  status: string;
  summary_json: string;
  created_at: string;
};

export type AutomationRule = {
  tenant_id: string;
  enabled: boolean;
  auto_reply_positive: boolean;
  require_approval_neutral: boolean;
  require_approval_negative: boolean;
  confidence_threshold: number;
  brand_tone: string;
  template_positive: string;
};

export type GoogleConnection = {
  id: string;
  tenant_id: string;
  google_email: string | null;
  status: string;
  last_synced_at: string | null;
  last_error: string | null;
};

export type Store = {
  users: Map<string, User>;
  tenants: Map<string, Tenant>;
  memberships: Map<string, Membership>;
  accounts: Map<string, { id: string; tenant_id: string; display_name: string }>;
  locations: Map<string, Location>;
  reviews: Map<string, Review>;
  posts: Map<string, Post>;
  media: Map<string, Media>;
  tasks: Map<string, Task>;
  metrics: Metric[];
  reports: Map<string, Report>;
  automation: Map<string, AutomationRule>;
  connections: Map<string, GoogleConnection>;
  seeded: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __vyapaarStore: Store | undefined;
}

function id(prefix = "") {
  return `${prefix}${crypto.randomUUID()}`;
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function dateOnly(daysAgo: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export function createEmptyStore(): Store {
  return {
    users: new Map(),
    tenants: new Map(),
    memberships: new Map(),
    accounts: new Map(),
    locations: new Map(),
    reviews: new Map(),
    posts: new Map(),
    media: new Map(),
    tasks: new Map(),
    metrics: [],
    reports: new Map(),
    automation: new Map(),
    connections: new Map(),
    seeded: false,
  };
}

export function seedDemoWorkspace(store: Store) {
  // Clear previous demo rows for re-seed
  for (const [uid, user] of store.users) {
    if (user.email === DEMO_EMAIL) store.users.delete(uid);
  }

  const userId = id("usr_");
  const tenantId = id("ten_");
  const membershipId = id("mem_");
  const accountId = id("acc_");
  const locationId = id("loc_");
  const connectionId = id("gcon_");

  const hashed = bcrypt.hashSync(DEMO_PASSWORD, 10);

  store.users.set(userId, {
    id: userId,
    email: DEMO_EMAIL,
    hashed_password: hashed,
    full_name: "Rajveer Owner",
    platform_role: "user",
    brand_tone: "friendly",
  });

  store.tenants.set(tenantId, {
    id: tenantId,
    name: "Rajveer Chinese",
    slug: "rajveer-chinese",
    plan: "starter",
    status: "active",
  });

  store.memberships.set(membershipId, {
    id: membershipId,
    user_id: userId,
    tenant_id: tenantId,
    role: "owner",
    status: "active",
  });

  store.connections.set(connectionId, {
    id: connectionId,
    tenant_id: tenantId,
    google_email: "demo@rajveerchinese.demo",
    status: "demo",
    last_synced_at: new Date().toISOString(),
    last_error: null,
  });

  store.accounts.set(accountId, {
    id: accountId,
    tenant_id: tenantId,
    display_name: "Rajveer Chinese",
  });

  const description =
    "Rajveer Chinese serves bold Indo-Chinese plates in Vadjal — Hakka noodles, Veg Manchurian, chilli paneer, and Schezwan specials near Yashvantrao Chavan High School on Mayani–Mhaswad Road.";

  store.locations.set(locationId, {
    id: locationId,
    tenant_id: tenantId,
    account_id: accountId,
    title: "Rajveer Chinese",
    address:
      "Mayani, Mhaswad Road, Near Yashvantrao Chavan High School, Vadjal, Satara, Maharashtra 415509",
    phone: "+91 98765 43210",
    website: "https://rajveerchinese.local",
    primary_category: "Chinese restaurant",
    description,
    is_selected: true,
    sync_status: "demo",
    metadata: {
      hours: "11:00 AM – 10:30 PM daily",
      services: [
        "Veg Manchurian",
        "Hakka Noodles",
        "Fried Rice",
        "Chilli Paneer",
        "Schezwan Specials",
        "Soups & Starters",
      ],
      attributes: ["Takeaway", "Dine-in", "Family portions", "Vegetarian options"],
      source: "chinese_web",
    },
  });

  const reviewRows: Array<[string, number, string, number, boolean, string | null]> = [
    ["Priya Deshmukh", 5, "Best Hakka noodles in Vadjal! Fresh, spicy, and quick takeaway near the school.", -2, true, "Thank you Priya! Glad the Hakka noodles hit the spot. See you again soon."],
    ["Amit Jadhav", 5, "Chilli paneer was excellent. Family portions are generous. Highly recommend Rajveer Chinese.", -5, true, "Thanks Amit! Family portions are our speciality — come hungry next time too."],
    ["Sneha Patil", 4, "Manchurian gravy is tangy and crispy. Parking is a bit tight on weekends.", -8, false, null],
    ["Rohan Kulkarni", 5, "Schezwan fried rice with perfect heat. Open late which helps after evening tuition.", -1, true, "Appreciate it Rohan! We're open till 10:30 PM every day."],
    ["Meera Shah", 3, "Food was good but wait time was long on Saturday evening. Please improve service speed.", -3, false, null],
    ["Vikas More", 2, "Ordered chilli paneer takeaway — arrived lukewarm. Taste was okay but temperature disappointed.", -4, false, null],
    ["Ananya Joshi", 5, "Hot & sour soup and spring rolls are amazing starters. Kids loved the noodles.", -6, true, "So happy the kids enjoyed it, Ananya! Hot & sour is a house favourite."],
    ["Sagar Pawar", 4, "Authentic Indo-Chinese flavours. Near Yashvantrao Chavan High School — very convenient.", -10, false, null],
    ["Kavita Rane", 1, "Wrong order delivered once. Staff apologised but it ruined dinner plans.", -7, false, null],
    ["Nikhil Shinde", 5, "Best Chinese stop in Satara side. Bold flavours, fresh wok, fair prices.", -12, true, "Thank you Nikhil! Fresh wok, every plate — that's our promise."],
    ["Pooja Ghule", 4, "Veg Manchurian dumplings were crispy. Would love more dessert options though.", -14, false, null],
    ["Aditya Salunkhe", 5, "Came from Mhaswad Road specifically for Schezwan specials. Worth the drive!", -16, true, "Worth the drive means everything to us. Welcome back anytime, Aditya."],
  ];

  for (const [name, stars, comment, days, answered, reply] of reviewRows) {
    const rid = id("rev_");
    const created = daysAgoIso(days);
    store.reviews.set(rid, {
      id: rid,
      tenant_id: tenantId,
      location_id: locationId,
      reviewer_name: name,
      star_rating: stars,
      comment,
      review_created_at: created,
      reply_comment: reply,
      reply_updated_at: reply ? daysAgoIso(days + 0.25) : null,
      is_answered: answered,
      sentiment: stars >= 4 ? "positive" : stars === 3 ? "neutral" : "negative",
    });
  }

  const posts: Array<[string, string, string, number | null]> = [
    ["STANDARD", "Crispy Veg Manchurian just off the wok — tangy Indo-Chinese gravy, made to order in Vadjal.", "published", -1],
    ["STANDARD", "Craving Hakka Noodles after school? We're open till 10:30 PM on Mayani–Mhaswad Road.", "published", -4],
    ["OFFER", "Family feast night: share Schezwan specials + fried rice. Ask for your spice level!", "scheduled", 2],
    ["STANDARD", "Hot & sour soup and spring rolls — the starters locals come back for.", "draft", null],
    ["EVENT", "Weekend rush hours: order ahead for takeaway near Yashvantrao Chavan High School.", "published", -9],
  ];

  for (const [postType, summary, status, offset] of posts) {
    const pid = id("post_");
    store.posts.set(pid, {
      id: pid,
      tenant_id: tenantId,
      location_id: locationId,
      google_post_name: `localPosts/demo-${status}-${Math.abs(offset || 0)}`,
      post_type: postType,
      summary,
      cta_type: "LEARN_MORE",
      cta_url: "https://maps.google.com/?q=Rajveer+Chinese+Vadjal",
      status,
      scheduled_for: offset != null && status === "scheduled" ? daysAgoIso(offset) : null,
      published_at: offset != null && status === "published" ? daysAgoIso(offset) : null,
      created_at: new Date().toISOString(),
    });
  }

  const unanswered = [...store.reviews.values()].filter((r) => r.tenant_id === tenantId && !r.is_answered).length;
  const publishedCount = [...store.posts.values()].filter((p) => p.tenant_id === tenantId && p.status === "published").length;
  const draftCount = [...store.posts.values()].filter((p) => p.tenant_id === tenantId && p.status === "draft").length;

  const taskDefs: Array<[string, string, string, string]> = [
    ["Respond to unanswered reviews", `${unanswered} reviews still need a reply, including low-star feedback.`, "high", "Protect rating & trust"],
    ["Refresh Google Posts", `${publishedCount} published and ${draftCount} draft post(s) on file — keep the feed active this week.`, "medium", "Visibility"],
    ["Add dessert / beverage services", "Customers asked for dessert options — add supported services if available.", "low", "Profile completeness"],
    ["Upload fresh food photos", "Add Manchurian, Hakka noodles, and chilli paneer photos from the wok.", "medium", "Click-through"],
    ["Tighten weekend staffing note", "Mention peak-hour takeaway wait in description to set expectations.", "medium", "Fewer 3-star service complaints"],
  ];

  taskDefs.forEach(([title, desc, priority, benefit], i) => {
    const tid = id("task_");
    store.tasks.set(tid, {
      id: tid,
      tenant_id: tenantId,
      location_id: locationId,
      title,
      description: desc,
      priority,
      expected_benefit: benefit,
      status: "open",
      sort_order: i,
    });
  });

  // Strip old metrics for this tenant then reseed 60 days
  store.metrics = store.metrics.filter((m) => m.tenant_id !== tenantId);
  const metricBases: Array<[string, number]> = [
    ["BUSINESS_IMPRESSIONS_DESKTOP_MAPS", 38],
    ["BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", 55],
    ["BUSINESS_IMPRESSIONS_MOBILE_MAPS", 96],
    ["BUSINESS_IMPRESSIONS_MOBILE_SEARCH", 140],
    ["CALL_CLICKS", 7],
    ["WEBSITE_CLICKS", 12],
    ["BUSINESS_DIRECTION_REQUESTS", 18],
    ["MESSAGING_CLICKS", 3],
    ["BUSINESS_BOOKINGS", 1],
    ["BUSINESS_FOOD_MENU_CLICKS", 5],
  ];

  for (let day = 0; day < 60; day++) {
    const wave = day % 7;
    const metricDate = dateOnly(day);
    for (const [name, base] of metricBases) {
      const jitter = ((day * 13 + name.length * 7) % 11) - 5;
      const weekendBoost = wave === 5 || wave === 6 ? 1.25 : 1;
      store.metrics.push({
        tenant_id: tenantId,
        location_id: locationId,
        metric_date: metricDate,
        metric_name: name,
        metric_value: Math.max(0, Math.round(base * weekendBoost + jitter + (60 - day) * 0.15)),
      });
    }
  }

  store.automation.set(tenantId, {
    tenant_id: tenantId,
    enabled: false,
    auto_reply_positive: true,
    require_approval_neutral: true,
    require_approval_negative: true,
    confidence_threshold: 0.7,
    brand_tone: "friendly",
    template_positive:
      '[[META]]{"auto_ai_reply_enabled":false,"auto_reply_min_rating":5,"escalate_keywords":"legal,lawyer,refund,food poisoning,police","notify_email":true,"notify_whatsapp":false,"schedule_posts_enabled":true,"quiet_hours_start":"22:00","quiet_hours_end":"08:00"}[[/META]]Thank you for reviewing {business}! We appreciate your support.',
  });

  store.seeded = true;
  return {
    ok: true,
    message: "Demo workspace ready",
    demo_login: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    tenant_id: tenantId,
    location_id: locationId,
  };
}

export function getStore(): Store {
  if (!globalThis.__vyapaarStore) {
    const store = createEmptyStore();
    seedDemoWorkspace(store);
    globalThis.__vyapaarStore = store;
  }
  return globalThis.__vyapaarStore;
}

export function selectedLocationIds(store: Store, tenantId: string): string[] {
  const selected = [...store.locations.values()].filter((l) => l.tenant_id === tenantId && l.is_selected);
  if (selected.length) return selected.map((l) => l.id);
  return [...store.locations.values()].filter((l) => l.tenant_id === tenantId).map((l) => l.id);
}

export function resolveLocationIds(store: Store, tenantId: string, locationId?: string | null) {
  if (locationId) return [locationId];
  return selectedLocationIds(store, tenantId);
}

export function reviewStats(store: Store, tenantId: string, locationIds: string[]) {
  const rows = [...store.reviews.values()].filter(
    (r) => r.tenant_id === tenantId && (!locationIds.length || locationIds.includes(r.location_id))
  );
  const avg = rows.length ? rows.reduce((s, r) => s + r.star_rating, 0) / rows.length : 0;
  return {
    reviews: rows.length,
    average_rating: Math.round(avg * 10) / 10,
    unanswered_reviews: rows.filter((r) => !r.is_answered).length,
  };
}

export function postStats(store: Store, tenantId: string, locationIds: string[]) {
  const rows = [...store.posts.values()].filter(
    (p) => p.tenant_id === tenantId && (!locationIds.length || locationIds.includes(p.location_id))
  );
  return {
    total_posts: rows.length,
    published_posts: rows.filter((p) => p.status === "published").length,
    scheduled_posts: rows.filter((p) => p.status === "scheduled").length,
    draft_posts: rows.filter((p) => p.status === "draft").length,
    pending_sync_posts: rows.filter((p) => p.status === "pending_sync").length,
  };
}

export function mediaStats(store: Store, tenantId: string, locationIds: string[]) {
  const rows = [...store.media.values()].filter(
    (m) => m.tenant_id === tenantId && (!locationIds.length || locationIds.includes(m.location_id))
  );
  return {
    photos: rows.filter((m) => (m.media_format || "PHOTO") === "PHOTO").length,
    videos: rows.filter((m) => m.media_format === "VIDEO").length,
  };
}

export function locationPayload(loc: Location) {
  return {
    id: loc.id,
    title: loc.title,
    address: loc.address,
    phone: loc.phone,
    website: loc.website,
    primary_category: loc.primary_category,
    description: loc.description,
    hours: loc.metadata.hours,
    services: loc.metadata.services || [],
    attributes: loc.metadata.attributes || [],
    is_selected: loc.is_selected,
    sync_status: loc.sync_status,
  };
}

export { id as newId };
