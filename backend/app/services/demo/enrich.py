"""Ensure demo Rajveer Chinese location always has full profile fields."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.business import BusinessLocation
from app.models.performance import PerformanceMetric
from app.models.user import User
from app.services.demo.seed import DEMO_EMAIL

DEMO_ENGAGEMENT_BASES = [
    ("BUSINESS_IMPRESSIONS_DESKTOP_MAPS", 38),
    ("BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", 55),
    ("BUSINESS_IMPRESSIONS_MOBILE_MAPS", 96),
    ("BUSINESS_IMPRESSIONS_MOBILE_SEARCH", 142),
    ("CALL_CLICKS", 7),
    ("WEBSITE_CLICKS", 11),
    ("BUSINESS_DIRECTION_REQUESTS", 16),
    ("MESSAGING_CLICKS", 3),
    ("BUSINESS_FOOD_MENU_CLICKS", 5),
    ("BUSINESS_BOOKINGS", 1),
]


def enrich_demo_profile(db: Session) -> None:
    user = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if not user:
        return
    from app.models.tenant import TenantMembership

    membership = db.query(TenantMembership).filter(TenantMembership.user_id == user.id).first()
    if not membership:
        return

    location = (
        db.query(BusinessLocation)
        .filter(BusinessLocation.tenant_id == membership.tenant_id)
        .order_by(BusinessLocation.created_at.asc())
        .first()
    )
    if not location:
        return

    description = (
        "At Rajveer Chinese we keep it simple: fresh ingredients, a hot wok, "
        "and flavours that hit the spot every time. Whether you’re craving noodles "
        "after school or a full Indo-Chinese spread with family, we’re here in Vadjal for you. "
        "Dine in · Takeaway · Family portions."
    )
    meta = {
        "hours": "11:00 AM – 10:30 PM daily",
        "services": [
            "Veg Manchurian",
            "Hakka Noodles",
            "Fried Rice",
            "Chilli Paneer",
            "Schezwan Specials",
            "Soups & Starters",
        ],
        "attributes": ["Takeaway", "Dine-in", "Family portions", "Vegetarian options"],
        "source": "chinese_web",
    }

    changed = False
    if not location.description:
        location.description = description
        changed = True
    if not location.website:
        location.website = "https://rajveerchinese.local"
        changed = True
    if not location.phone:
        location.phone = "+91 98765 43210"
        changed = True
    if not location.address:
        location.address = (
            "Mayani, Mhaswad Road, Near Yashvantrao Chavan High School, Vadjal, Satara, Maharashtra 415509"
        )
        changed = True
    if not location.primary_category:
        location.primary_category = "Chinese restaurant"
        changed = True
    if not location.metadata_json:
        location.metadata_json = json.dumps(meta)
        changed = True
    else:
        try:
            existing = json.loads(location.metadata_json)
        except Exception:
            existing = {}
        if not existing.get("services") or not existing.get("hours"):
            existing.update({k: v for k, v in meta.items() if not existing.get(k)})
            location.metadata_json = json.dumps(existing)
            changed = True

    if changed:
        db.add(location)
        db.commit()

    enrich_demo_engagement(db, location)


def enrich_demo_engagement(db: Session, location: BusinessLocation) -> None:
    """Backfill missing Performance API-style metrics so dashboard engagement works in demo."""
    now = datetime.now(timezone.utc)
    existing = {
        (row.metric_date.isoformat(), row.metric_name)
        for row in db.query(PerformanceMetric)
        .filter(
            PerformanceMetric.tenant_id == location.tenant_id,
            PerformanceMetric.location_id == location.id,
        )
        .all()
    }
    added = 0
    # Keep enough history for month / quarter filters on Overview.
    for day in range(120):
        metric_day = (now - timedelta(days=day)).date()
        wave = day % 7
        for name, base in DEMO_ENGAGEMENT_BASES:
            key = (metric_day.isoformat(), name)
            if key in existing:
                continue
            db.add(
                PerformanceMetric(
                    tenant_id=location.tenant_id,
                    location_id=location.id,
                    metric_date=metric_day,
                    metric_name=name,
                    metric_value=float(base + wave * 3 + (day % 5)),
                )
            )
            added += 1
    if added:
        db.commit()
