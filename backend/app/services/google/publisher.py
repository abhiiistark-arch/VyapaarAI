"""GBP write gateway.

Every UI action that should update Google Business Profile goes through here.
- DEMO_MODE / no live Google: persist locally and mark `queued_for_google`
- USE_LIVE_GOOGLE=true: call the real GBP APIs (wired endpoint-by-endpoint)

This keeps the product usable now and switchable later via env only.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.business import BusinessLocation
from app.models.google import GoogleConnection
from app.models.posts import BusinessPost, PostMedia
from app.models.reviews import Review
from app.services.google.gbp import GBPClient, GoogleAPIError, get_valid_client


def _publish_meta(live: bool, action: str) -> dict[str, Any]:
    return {
        "applied_locally": True,
        "pushed_to_google": live,
        "action": action,
        "mode": "live" if live else "demo_queue",
        "note": (
            "Updated on Google Business Profile."
            if live
            else "Saved in VyapaarAI. Will sync to Google when USE_LIVE_GOOGLE=true."
        ),
        "at": datetime.now(timezone.utc).isoformat(),
    }


def update_location_profile(
    db: Session,
    location: BusinessLocation,
    *,
    description: str | None = None,
    website: str | None = None,
    phone: str | None = None,
    title: str | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    if description is not None:
        location.description = description
    if website is not None:
        location.website = website
    if phone is not None:
        location.phone = phone
    if title is not None:
        location.title = title

    live = False
    if settings.google_live_enabled:
        connection = (
            db.query(GoogleConnection)
            .filter(
                GoogleConnection.tenant_id == location.tenant_id,
                GoogleConnection.status == "connected",
            )
            .first()
        )
        if not connection:
            raise GoogleAPIError(400, "Google is not connected for this workspace")
        client: GBPClient = get_valid_client(db, connection)
        # Business Information patch will be completed when API access is approved.
        # For now we still persist locally and document the intended Google write.
        _ = client
        location.sync_status = "pending_google_write"
        live = False  # flip to True once patchLocation is verified against your approved APIs
    else:
        location.sync_status = "demo_saved"

    db.add(location)
    db.commit()
    db.refresh(location)
    return {
        "location": {
            "id": location.id,
            "title": location.title,
            "description": location.description,
            "website": location.website,
            "phone": location.phone,
            "sync_status": location.sync_status,
        },
        **_publish_meta(live, "update_location_profile"),
    }


def publish_review_reply(db: Session, review: Review, reply: str) -> dict[str, Any]:
    settings = get_settings()
    review.reply_comment = reply
    review.reply_updated_at = datetime.now(timezone.utc)
    review.is_answered = True

    live = False
    if settings.google_live_enabled:
        connection = (
            db.query(GoogleConnection)
            .filter(
                GoogleConnection.tenant_id == review.tenant_id,
                GoogleConnection.status == "connected",
            )
            .first()
        )
        if connection:
            client = get_valid_client(db, connection)
            client.reply_to_review(review.google_review_name, reply)
            live = True

    db.add(review)
    db.commit()
    return {
        "review_id": review.id,
        "reply_comment": review.reply_comment,
        "is_answered": True,
        **_publish_meta(live, "publish_review_reply"),
    }


def create_or_update_post(
    db: Session,
    *,
    tenant_id: str,
    location_id: str,
    summary: str,
    post_type: str = "STANDARD",
    status: str = "draft",
    cta_type: str | None = "LEARN_MORE",
    cta_url: str | None = None,
    post_id: str | None = None,
    scheduled_for: datetime | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    post = None
    if post_id:
        post = (
            db.query(BusinessPost)
            .filter(BusinessPost.id == post_id, BusinessPost.tenant_id == tenant_id)
            .first()
        )
    if not post:
        post = BusinessPost(tenant_id=tenant_id, location_id=location_id)
        db.add(post)

    post.summary = summary
    post.post_type = post_type
    post.status = status
    post.cta_type = cta_type
    post.cta_url = cta_url
    if scheduled_for is not None:
        post.scheduled_for = scheduled_for
        if status in {"draft", "scheduled"}:
            post.status = "scheduled"
    if status == "published":
        post.published_at = datetime.now(timezone.utc)

    live = False
    if settings.google_live_enabled and status == "published":
        # Local Posts create will be enabled after GBP API approval.
        post.status = "queued_for_google"
        live = False

    db.commit()
    db.refresh(post)
    return {
        "post": {
            "id": post.id,
            "summary": post.summary,
            "post_type": post.post_type,
            "status": post.status,
            "cta_type": post.cta_type,
            "cta_url": post.cta_url,
            "scheduled_for": post.scheduled_for.isoformat() if post.scheduled_for else None,
        },
        **_publish_meta(live, "create_or_update_post"),
    }


def add_media(
    db: Session,
    *,
    tenant_id: str,
    location_id: str,
    source_url: str,
    category: str = "ADDITIONAL",
    caption: str = "",
    media_format: str = "PHOTO",
    post_id: str | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    fmt = (media_format or "PHOTO").upper()
    if fmt not in {"PHOTO", "VIDEO"}:
        fmt = "PHOTO"
    media = PostMedia(
        tenant_id=tenant_id,
        location_id=location_id,
        post_id=post_id,
        source_url=source_url,
        media_format=fmt,
        category=category,
        status="demo_saved" if not settings.google_live_enabled else "queued_for_google",
    )
    # Store caption on category suffix only if empty category — prefer google_media_name note field unused.
    if caption:
        media.google_media_name = media.google_media_name or f"caption:{caption[:200]}"
    db.add(media)
    db.commit()
    db.refresh(media)
    return {
        "media": {
            "id": media.id,
            "source_url": media.source_url,
            "category": media.category,
            "status": media.status,
            "media_format": media.media_format,
            "post_id": media.post_id,
            "caption": caption,
        },
        **_publish_meta(False, "add_media"),
    }
