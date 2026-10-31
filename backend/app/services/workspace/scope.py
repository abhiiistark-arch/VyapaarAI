"""Single source of truth for workspace scoping + post/review counts.

Dashboard, Posts, Reviews, and future Google sync all use these helpers so
demo data and live GBP data stay consistent.
"""

from __future__ import annotations

from typing import Iterable

from sqlalchemy.orm import Query, Session

from app.models.business import BusinessLocation
from app.models.posts import BusinessPost, PostMedia
from app.models.reviews import Review

# Canonical post statuses used across demo + live Google sync.
STATUS_PUBLISHED = "published"
STATUS_SCHEDULED = "scheduled"
STATUS_DRAFT = "draft"
STATUS_QUEUED = "queued_for_google"  # saved locally, waiting for GBP write

PUBLISHED_STATUSES = frozenset({STATUS_PUBLISHED})
SCHEDULED_STATUSES = frozenset({STATUS_SCHEDULED})
DRAFT_STATUSES = frozenset({STATUS_DRAFT})
PENDING_SYNC_STATUSES = frozenset({STATUS_QUEUED})


def selected_location_ids(db: Session, tenant_id: str) -> list[str]:
    rows = (
        db.query(BusinessLocation.id)
        .filter(
            BusinessLocation.tenant_id == tenant_id,
            BusinessLocation.is_selected.is_(True),
        )
        .all()
    )
    ids = [row[0] for row in rows]
    if ids:
        return ids
    # If nothing selected yet, fall back to all locations for this tenant.
    all_rows = (
        db.query(BusinessLocation.id)
        .filter(BusinessLocation.tenant_id == tenant_id)
        .all()
    )
    return [row[0] for row in all_rows]


def resolve_location_ids(
    db: Session,
    tenant_id: str,
    location_id: str | None = None,
) -> list[str]:
    if location_id:
        row = (
            db.query(BusinessLocation)
            .filter(
                BusinessLocation.id == location_id,
                BusinessLocation.tenant_id == tenant_id,
            )
            .first()
        )
        return [row.id] if row else []
    return selected_location_ids(db, tenant_id)


def scope_posts(
    db: Session,
    tenant_id: str,
    location_ids: Iterable[str] | None = None,
) -> Query:
    query = db.query(BusinessPost).filter(BusinessPost.tenant_id == tenant_id)
    ids = list(location_ids) if location_ids is not None else selected_location_ids(db, tenant_id)
    if ids:
        query = query.filter(BusinessPost.location_id.in_(ids))
    return query


def scope_media(
    db: Session,
    tenant_id: str,
    location_ids: Iterable[str] | None = None,
) -> Query:
    query = db.query(PostMedia).filter(PostMedia.tenant_id == tenant_id)
    ids = list(location_ids) if location_ids is not None else selected_location_ids(db, tenant_id)
    if ids:
        query = query.filter(PostMedia.location_id.in_(ids))
    return query


def scope_reviews(
    db: Session,
    tenant_id: str,
    location_ids: Iterable[str] | None = None,
) -> Query:
    query = db.query(Review).filter(Review.tenant_id == tenant_id)
    ids = list(location_ids) if location_ids is not None else selected_location_ids(db, tenant_id)
    if ids:
        query = query.filter(Review.location_id.in_(ids))
    return query


def post_stats(db: Session, tenant_id: str, location_ids: Iterable[str] | None = None) -> dict:
    query = scope_posts(db, tenant_id, location_ids)
    rows = query.all()
    published = sum(1 for row in rows if row.status in PUBLISHED_STATUSES)
    scheduled = sum(1 for row in rows if row.status in SCHEDULED_STATUSES)
    drafts = sum(1 for row in rows if row.status in DRAFT_STATUSES)
    pending_sync = sum(1 for row in rows if row.status in PENDING_SYNC_STATUSES)
    other = len(rows) - published - scheduled - drafts - pending_sync
    return {
        "total_posts": len(rows),
        "published_posts": published,
        "scheduled_posts": scheduled,
        "draft_posts": drafts,
        "pending_sync_posts": pending_sync,
        "other_posts": max(0, other),
        "scoped_location_ids": list(location_ids)
        if location_ids is not None
        else selected_location_ids(db, tenant_id),
    }


def review_stats(db: Session, tenant_id: str, location_ids: Iterable[str] | None = None) -> dict:
    from sqlalchemy import func

    query = scope_reviews(db, tenant_id, location_ids)
    total = query.count()
    unanswered = query.filter(Review.is_answered.is_(False)).count()
    avg = query.with_entities(func.avg(Review.star_rating)).scalar() or 0
    return {
        "reviews": total,
        "unanswered_reviews": unanswered,
        "average_rating": round(float(avg), 2),
    }


def media_stats(db: Session, tenant_id: str, location_ids: Iterable[str] | None = None) -> dict:
    query = scope_media(db, tenant_id, location_ids)
    rows = query.all()
    photos = sum(1 for row in rows if (row.media_format or "PHOTO").upper() == "PHOTO")
    videos = sum(1 for row in rows if (row.media_format or "").upper() == "VIDEO")
    return {
        "total_media": len(rows),
        "photos": photos,
        "videos": videos,
    }
