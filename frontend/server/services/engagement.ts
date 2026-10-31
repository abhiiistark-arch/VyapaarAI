import { Store } from "../db/store";

const IMPRESSION_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
] as const;

const ALL_METRICS = [
  ...IMPRESSION_METRICS,
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
  "MESSAGING_CLICKS",
  "BUSINESS_BOOKINGS",
  "BUSINESS_FOOD_MENU_CLICKS",
] as const;

function parseDate(iso: string) {
  return new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function delta(current: number, previous: number) {
  if (previous <= 0) return current <= 0 ? null : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function engagementSummary(
  store: Store,
  tenantId: string,
  locationIds: string[],
  opts: { days?: number; start_date?: string | null; end_date?: string | null } = {}
) {
  let end = opts.end_date ? parseDate(opts.end_date) : new Date();
  end = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  let start: Date;
  if (opts.start_date) {
    start = parseDate(opts.start_date);
    start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  } else {
    const days = Math.max(opts.days ?? 30, 1);
    start = addDays(end, -(days - 1));
  }
  if (start > end) [start, end] = [end, start];
  if ((end.getTime() - start.getTime()) / 86400000 + 1 > 366) {
    start = addDays(end, -365);
  }

  const startStr = toIsoDate(start);
  const endStr = toIsoDate(end);

  const inRange = store.metrics.filter(
    (m) =>
      m.tenant_id === tenantId &&
      m.metric_date >= startStr &&
      m.metric_date <= endStr &&
      (!locationIds.length || locationIds.includes(m.location_id))
  );

  const rows: Record<string, number> = {};
  for (const m of inRange) {
    rows[m.metric_name] = (rows[m.metric_name] || 0) + m.metric_value;
  }

  const impressions = IMPRESSION_METRICS.reduce((s, n) => s + (rows[n] || 0), 0);
  const calls = rows.CALL_CLICKS || 0;
  const website = rows.WEBSITE_CLICKS || 0;
  const directions = rows.BUSINESS_DIRECTION_REQUESTS || 0;
  const messages = rows.MESSAGING_CLICKS || 0;
  const bookings = rows.BUSINESS_BOOKINGS || 0;
  const menu = rows.BUSINESS_FOOD_MENU_CLICKS || 0;
  const actions = calls + website + directions + messages + bookings + menu;

  const periodLen = Math.max(Math.round((end.getTime() - start.getTime()) / 86400000), 0);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -periodLen);
  const prevStartStr = toIsoDate(prevStart);
  const prevEndStr = toIsoDate(prevEnd);
  const prevRows: Record<string, number> = {};
  for (const m of store.metrics) {
    if (
      m.tenant_id === tenantId &&
      m.metric_date >= prevStartStr &&
      m.metric_date <= prevEndStr &&
      (!locationIds.length || locationIds.includes(m.location_id))
    ) {
      prevRows[m.metric_name] = (prevRows[m.metric_name] || 0) + m.metric_value;
    }
  }
  const prevImpressions = IMPRESSION_METRICS.reduce((s, n) => s + (prevRows[n] || 0), 0);

  const emptyDay = {
    views: 0,
    search: 0,
    maps: 0,
    calls: 0,
    website: 0,
    directions: 0,
    messages: 0,
    menu: 0,
    bookings: 0,
    actions: 0,
  };
  const dailyMap: Record<string, typeof emptyDay> = {};
  for (const m of inRange) {
    if (!(ALL_METRICS as readonly string[]).includes(m.metric_name)) continue;
    const bucket = (dailyMap[m.metric_date] ||= { ...emptyDay });
    const v = m.metric_value;
    if (
      m.metric_name === "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH" ||
      m.metric_name === "BUSINESS_IMPRESSIONS_MOBILE_SEARCH"
    ) {
      bucket.search += v;
      bucket.views += v;
    } else if (
      m.metric_name === "BUSINESS_IMPRESSIONS_DESKTOP_MAPS" ||
      m.metric_name === "BUSINESS_IMPRESSIONS_MOBILE_MAPS"
    ) {
      bucket.maps += v;
      bucket.views += v;
    } else if (m.metric_name === "CALL_CLICKS") bucket.calls += v;
    else if (m.metric_name === "WEBSITE_CLICKS") bucket.website += v;
    else if (m.metric_name === "BUSINESS_DIRECTION_REQUESTS") bucket.directions += v;
    else if (m.metric_name === "MESSAGING_CLICKS") bucket.messages += v;
    else if (m.metric_name === "BUSINESS_FOOD_MENU_CLICKS") bucket.menu += v;
    else if (m.metric_name === "BUSINESS_BOOKINGS") bucket.bookings += v;
    bucket.actions =
      bucket.calls + bucket.website + bucket.directions + bucket.messages + bucket.menu + bucket.bookings;
  }

  const series: Array<{ date: string } & typeof emptyDay> = [];
  for (let c = new Date(start); c <= end; c = addDays(c, 1)) {
    const key = toIsoDate(c);
    series.push({ date: key, ...(dailyMap[key] || { ...emptyDay }) });
  }

  return {
    period_days: Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
    start_date: startStr,
    end_date: endStr,
    source: "performance_metrics",
    api: "businessprofileperformance.googleapis.com (fetchMultiDailyMetricsTimeSeries)",
    profile_views: Math.round(impressions),
    search_views: Math.round(
      (rows.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) + (rows.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0)
    ),
    maps_views: Math.round(
      (rows.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) + (rows.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0)
    ),
    website_clicks: Math.round(website),
    call_clicks: Math.round(calls),
    direction_requests: Math.round(directions),
    message_clicks: Math.round(messages),
    bookings: Math.round(bookings),
    menu_clicks: Math.round(menu),
    total_actions: Math.round(actions),
    conversion_rate_pct: impressions ? Math.round((actions / impressions) * 10000) / 100 : 0,
    deltas: {
      profile_views_pct: delta(impressions, prevImpressions),
      call_clicks_pct: delta(calls, prevRows.CALL_CLICKS || 0),
      website_clicks_pct: delta(website, prevRows.WEBSITE_CLICKS || 0),
      direction_requests_pct: delta(directions, prevRows.BUSINESS_DIRECTION_REQUESTS || 0),
    },
    breakdown: {
      impressions_desktop_maps: Math.round(rows.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0),
      impressions_desktop_search: Math.round(rows.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0),
      impressions_mobile_maps: Math.round(rows.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0),
      impressions_mobile_search: Math.round(rows.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0),
    },
    series,
  };
}
