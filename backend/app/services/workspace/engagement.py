"""Google Business Profile engagement / performance metrics.

Live source: Business Profile Performance API
  GET .../locations/{id}:fetchMultiDailyMetricsTimeSeries

Demo source: PerformanceMetric rows seeded locally.
Dashboard always reads from PerformanceMetric so demo + live stay consistent.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.performance import PerformanceMetric
from app.services.workspace.scope import selected_location_ids

# Canonical GBP DailyMetric names we care about for local businesses.
IMPRESSION_METRICS = (
    "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
)

ACTION_METRICS = (
    "CALL_CLICKS",
    "WEBSITE_CLICKS",
    "BUSINESS_DIRECTION_REQUESTS",
    "MESSAGING_CLICKS",
    "BUSINESS_BOOKINGS",
    "BUSINESS_FOOD_MENU_CLICKS",
)

ALL_ENGAGEMENT_METRICS = IMPRESSION_METRICS + ACTION_METRICS


def engagement_summary(
    db: Session,
    tenant_id: str,
    location_ids: Iterable[str] | None = None,
    *,
    days: int = 30,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    ids = list(location_ids) if location_ids is not None else selected_location_ids(db, tenant_id)
    end = end_date or date.today()
    if start_date:
        start = start_date
    else:
        start = end - timedelta(days=max(days - 1, 0))
    if start > end:
        start, end = end, start
    # Cap extremely long ranges for demo safety
    span_days = (end - start).days + 1
    if span_days > 366:
        start = end - timedelta(days=365)

    query = db.query(
        PerformanceMetric.metric_name,
        func.coalesce(func.sum(PerformanceMetric.metric_value), 0.0),
    ).filter(
        PerformanceMetric.tenant_id == tenant_id,
        PerformanceMetric.metric_date >= start,
        PerformanceMetric.metric_date <= end,
    )
    if ids:
        query = query.filter(PerformanceMetric.location_id.in_(ids))
    rows = {name: float(value) for name, value in query.group_by(PerformanceMetric.metric_name).all()}

    impressions = sum(rows.get(name, 0.0) for name in IMPRESSION_METRICS)
    calls = rows.get("CALL_CLICKS", 0.0)
    website = rows.get("WEBSITE_CLICKS", 0.0)
    directions = rows.get("BUSINESS_DIRECTION_REQUESTS", 0.0)
    messages = rows.get("MESSAGING_CLICKS", 0.0)
    bookings = rows.get("BUSINESS_BOOKINGS", 0.0)
    menu_clicks = rows.get("BUSINESS_FOOD_MENU_CLICKS", 0.0)
    actions = calls + website + directions + messages + bookings + menu_clicks
    conversion_rate = round((actions / impressions) * 100, 2) if impressions else 0.0

    # Previous period for simple trend arrows (same length)
    period_len = max((end - start).days, 0)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=period_len)
    prev_query = db.query(
        PerformanceMetric.metric_name,
        func.coalesce(func.sum(PerformanceMetric.metric_value), 0.0),
    ).filter(
        PerformanceMetric.tenant_id == tenant_id,
        PerformanceMetric.metric_date >= prev_start,
        PerformanceMetric.metric_date <= prev_end,
    )
    if ids:
        prev_query = prev_query.filter(PerformanceMetric.location_id.in_(ids))
    prev_rows = {name: float(value) for name, value in prev_query.group_by(PerformanceMetric.metric_name).all()}
    prev_impressions = sum(prev_rows.get(name, 0.0) for name in IMPRESSION_METRICS)
    prev_calls = prev_rows.get("CALL_CLICKS", 0.0)
    prev_website = prev_rows.get("WEBSITE_CLICKS", 0.0)
    prev_directions = prev_rows.get("BUSINESS_DIRECTION_REQUESTS", 0.0)

    def _delta(current: float, previous: float) -> float | None:
        if previous <= 0:
            return None if current <= 0 else 100.0
        return round(((current - previous) / previous) * 100, 1)

    # Daily series for charts — all engagement parameters, continuous calendar days.
    empty_day = {
        "views": 0.0,
        "search": 0.0,
        "maps": 0.0,
        "calls": 0.0,
        "website": 0.0,
        "directions": 0.0,
        "messages": 0.0,
        "menu": 0.0,
        "bookings": 0.0,
        "actions": 0.0,
    }
    daily_q = (
        db.query(
            PerformanceMetric.metric_date,
            PerformanceMetric.metric_name,
            func.coalesce(func.sum(PerformanceMetric.metric_value), 0.0),
        )
        .filter(
            PerformanceMetric.tenant_id == tenant_id,
            PerformanceMetric.metric_date >= start,
            PerformanceMetric.metric_date <= end,
            PerformanceMetric.metric_name.in_(ALL_ENGAGEMENT_METRICS),
        )
    )
    if ids:
        daily_q = daily_q.filter(PerformanceMetric.location_id.in_(ids))
    daily_map: dict[str, dict[str, float]] = {}
    for metric_date, metric_name, value in daily_q.group_by(
        PerformanceMetric.metric_date, PerformanceMetric.metric_name
    ).all():
        key = metric_date.isoformat()
        bucket = daily_map.setdefault(key, dict(empty_day))
        v = float(value)
        if metric_name in (
            "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
            "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
        ):
            bucket["search"] += v
            bucket["views"] += v
        elif metric_name in (
            "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
            "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
        ):
            bucket["maps"] += v
            bucket["views"] += v
        elif metric_name == "CALL_CLICKS":
            bucket["calls"] += v
        elif metric_name == "WEBSITE_CLICKS":
            bucket["website"] += v
        elif metric_name == "BUSINESS_DIRECTION_REQUESTS":
            bucket["directions"] += v
        elif metric_name == "MESSAGING_CLICKS":
            bucket["messages"] += v
        elif metric_name == "BUSINESS_FOOD_MENU_CLICKS":
            bucket["menu"] += v
        elif metric_name == "BUSINESS_BOOKINGS":
            bucket["bookings"] += v
        bucket["actions"] = (
            bucket["calls"]
            + bucket["website"]
            + bucket["directions"]
            + bucket["messages"]
            + bucket["menu"]
            + bucket["bookings"]
        )

    series = []
    cursor = start
    while cursor <= end:
        key = cursor.isoformat()
        series.append({"date": key, **(daily_map.get(key) or dict(empty_day))})
        cursor = cursor + timedelta(days=1)

    return {
        "period_days": (end - start).days + 1,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "source": "performance_metrics",
        "api": "businessprofileperformance.googleapis.com (fetchMultiDailyMetricsTimeSeries)",
        "profile_views": int(impressions),
        "search_views": int(
            rows.get("BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", 0)
            + rows.get("BUSINESS_IMPRESSIONS_MOBILE_SEARCH", 0)
        ),
        "maps_views": int(
            rows.get("BUSINESS_IMPRESSIONS_DESKTOP_MAPS", 0)
            + rows.get("BUSINESS_IMPRESSIONS_MOBILE_MAPS", 0)
        ),
        "website_clicks": int(website),
        "call_clicks": int(calls),
        "direction_requests": int(directions),
        "message_clicks": int(messages),
        "bookings": int(bookings),
        "menu_clicks": int(menu_clicks),
        "total_actions": int(actions),
        "conversion_rate_pct": conversion_rate,
        "deltas": {
            "profile_views_pct": _delta(impressions, prev_impressions),
            "call_clicks_pct": _delta(calls, prev_calls),
            "website_clicks_pct": _delta(website, prev_website),
            "direction_requests_pct": _delta(directions, prev_directions),
        },
        "breakdown": {
            "impressions_desktop_maps": int(rows.get("BUSINESS_IMPRESSIONS_DESKTOP_MAPS", 0)),
            "impressions_desktop_search": int(rows.get("BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", 0)),
            "impressions_mobile_maps": int(rows.get("BUSINESS_IMPRESSIONS_MOBILE_MAPS", 0)),
            "impressions_mobile_search": int(rows.get("BUSINESS_IMPRESSIONS_MOBILE_SEARCH", 0)),
        },
        "daily_series": series,  # full requested window for line charts
        "available_when_live": list(ALL_ENGAGEMENT_METRICS),
    }
