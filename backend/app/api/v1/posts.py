import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_membership
from app.db.session import get_db
from app.models.business import BusinessLocation
from app.models.posts import BusinessPost, PostMedia, ScheduledJob
from app.models.tenant import TenantMembership
from app.services.ai.gemini import generate_json
from app.services.ai.media_gen import generate_marketing_image
from app.services.ai.prompts import JSON_HINTS, local_post_prompt, photo_caption_prompt
from app.services.google.publisher import add_media, create_or_update_post
from app.services.workspace.scope import (
    media_stats,
    post_stats,
    resolve_location_ids,
    scope_media,
    scope_posts,
)

router = APIRouter(prefix="/posts", tags=["posts"])


class PostCreateRequest(BaseModel):
    location_id: str
    summary: str = Field(min_length=5, max_length=1500)
    post_type: str = "STANDARD"
    status: str = "draft"
    cta_type: str | None = "LEARN_MORE"
    cta_url: str | None = None
    media_url: str | None = None
    media_format: str = "PHOTO"
    scheduled_for: str | None = None  # ISO datetime


class PostGenerateRequest(BaseModel):
    location_id: str
    topic: str = ""
    tone: str = "friendly"
    mode: str = "post"  # post | caption


class MediaCreateRequest(BaseModel):
    location_id: str
    source_url: str
    category: str = "ADDITIONAL"
    caption: str = ""
    media_format: str = "PHOTO"
    post_id: str | None = None


class MediaGenerateRequest(BaseModel):
    location_id: str
    brief: str = ""
    category: str = "ADDITIONAL"
    style: str = "photorealistic food photography"
    save: bool = True


class ScheduleBatchRequest(BaseModel):
    location_id: str
    topics: list[str] = Field(min_length=1, max_length=20)
    tone: str = "friendly"
    start_at: str | None = None  # ISO; default tomorrow 10:00 UTC
    interval_days: int = Field(default=2, ge=1, le=14)
    generate_ai_copy: bool = True
    attach_ai_image: bool = False



def _location_meta(location: BusinessLocation) -> dict:
    if not location.metadata_json:
        return {}
    try:
        return json.loads(location.metadata_json)
    except Exception:
        return {}


def _serialize_post(row) -> dict:
    return {
        "id": row.id,
        "location_id": row.location_id,
        "post_type": row.post_type,
        "summary": row.summary,
        "status": row.status,
        "cta_type": row.cta_type,
        "cta_url": row.cta_url,
        "scheduled_for": row.scheduled_for.isoformat() if row.scheduled_for else None,
        "published_at": row.published_at.isoformat() if row.published_at else None,
        "google_post_name": row.google_post_name,
    }


def _serialize_media(row) -> dict:
    return {
        "id": row.id,
        "source_url": row.source_url,
        "category": row.category,
        "status": row.status,
        "location_id": row.location_id,
        "post_id": row.post_id,
        "media_format": row.media_format or "PHOTO",
    }


@router.get("")
def list_posts(
    location_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    """List posts for the same selected-location scope as the dashboard."""
    location_ids = resolve_location_ids(db, membership.tenant_id, location_id)
    query = scope_posts(db, membership.tenant_id, location_ids)
    if status:
        query = query.filter(BusinessPost.status == status)
    rows = query.order_by(BusinessPost.created_at.desc()).all()
    return {
        "items": [_serialize_post(row) for row in rows],
        "stats": post_stats(db, membership.tenant_id, location_ids),
        "scope": {"location_ids": location_ids},
    }


@router.get("/media")
def list_media(
    location_id: str | None = Query(default=None),
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    location_ids = resolve_location_ids(db, membership.tenant_id, location_id)
    rows = scope_media(db, membership.tenant_id, location_ids).order_by(PostMedia.created_at.desc()).all()
    return {
        "items": [_serialize_media(row) for row in rows],
        "stats": media_stats(db, membership.tenant_id, location_ids),
        "scope": {"location_ids": location_ids},
    }


@router.post("/generate")
def generate_post(
    payload: PostGenerateRequest,
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    location = (
        db.query(BusinessLocation)
        .filter(
            BusinessLocation.id == payload.location_id,
            BusinessLocation.tenant_id == membership.tenant_id,
        )
        .first()
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    meta = _location_meta(location)
    if payload.mode == "caption":
        prompt = photo_caption_prompt(
            location,
            caption_brief=payload.topic,
            media_category="ADDITIONAL",
            meta=meta,
        )
        hint = JSON_HINTS["photo_caption"]
    else:
        prompt = local_post_prompt(
            location,
            topic=payload.topic,
            tone=payload.tone,
            meta=meta,
        )
        hint = JSON_HINTS["post"]

    try:
        data = generate_json(prompt, hint)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Keep frontend compatibility for caption mode.
    if payload.mode == "caption" and "summary" not in data:
        data["summary"] = data.get("caption") or ""
    return data


@router.post("")
def create_post(
    payload: PostCreateRequest,
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    location = (
        db.query(BusinessLocation)
        .filter(
            BusinessLocation.id == payload.location_id,
            BusinessLocation.tenant_id == membership.tenant_id,
        )
        .first()
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    scheduled_for = None
    status = payload.status
    if payload.scheduled_for:
        try:
            scheduled_for = datetime.fromisoformat(payload.scheduled_for.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid scheduled_for datetime") from exc
        status = "scheduled"
    result = create_or_update_post(
        db,
        tenant_id=membership.tenant_id,
        location_id=payload.location_id,
        summary=payload.summary,
        post_type=payload.post_type,
        status=status,
        cta_type=payload.cta_type,
        cta_url=payload.cta_url or location.website,
        scheduled_for=scheduled_for,
    )
    if payload.media_url:
        media = add_media(
            db,
            tenant_id=membership.tenant_id,
            location_id=payload.location_id,
            source_url=payload.media_url,
            category="ADDITIONAL",
            caption="",
            media_format=payload.media_format or "PHOTO",
            post_id=result.get("post", {}).get("id"),
        )
        result["media"] = media.get("media")
    result["stats"] = post_stats(db, membership.tenant_id, [payload.location_id])
    return result


@router.post("/media")
def create_media(
    payload: MediaCreateRequest,
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    location = (
        db.query(BusinessLocation)
        .filter(
            BusinessLocation.id == payload.location_id,
            BusinessLocation.tenant_id == membership.tenant_id,
        )
        .first()
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    result = add_media(
        db,
        tenant_id=membership.tenant_id,
        location_id=payload.location_id,
        source_url=payload.source_url,
        category=payload.category,
        caption=payload.caption,
        media_format=payload.media_format or "PHOTO",
        post_id=payload.post_id,
    )
    result["stats"] = media_stats(db, membership.tenant_id, [payload.location_id])
    return result


@router.post("/media/generate")
def generate_media(
    payload: MediaGenerateRequest,
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    location = (
        db.query(BusinessLocation)
        .filter(
            BusinessLocation.id == payload.location_id,
            BusinessLocation.tenant_id == membership.tenant_id,
        )
        .first()
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    meta = _location_meta(location)
    try:
        generated = generate_marketing_image(
            location,
            brief=payload.brief,
            media_category=payload.category,
            style=payload.style,
            meta=meta,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    saved = None
    if payload.save and generated.get("source_url"):
        saved = add_media(
            db,
            tenant_id=membership.tenant_id,
            location_id=payload.location_id,
            source_url=generated["source_url"],
            category=payload.category,
            caption=generated.get("caption") or "",
            media_format="PHOTO",
        )
    return {
        **generated,
        "media": saved.get("media") if saved else None,
        "note": (
            "AI image ready."
            if generated.get("generation_source") == "gemini_image"
            else "AI poster generated (image-model quota busy — SVG poster fallback used)."
        ),
    }


@router.post("/schedule-batch")
def schedule_batch(
    payload: ScheduleBatchRequest,
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    """Schedule multiple posts from a topic list (optional AI copy + AI image)."""
    location = (
        db.query(BusinessLocation)
        .filter(
            BusinessLocation.id == payload.location_id,
            BusinessLocation.tenant_id == membership.tenant_id,
        )
        .first()
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    if payload.start_at:
        try:
            cursor = datetime.fromisoformat(payload.start_at.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid start_at datetime") from exc
    else:
        cursor = datetime.now(timezone.utc).replace(hour=10, minute=0, second=0, microsecond=0)
        if cursor <= datetime.now(timezone.utc):
            cursor = cursor + timedelta(days=1)

    meta = _location_meta(location)
    created = []
    for topic in payload.topics:
        topic = (topic or "").strip()
        if not topic:
            continue
        summary = topic
        if payload.generate_ai_copy:
            try:
                data = generate_json(
                    local_post_prompt(location, topic=topic, tone=payload.tone, meta=meta),
                    JSON_HINTS["post"],
                )
                summary = data.get("summary") or topic
            except Exception:
                summary = f"{topic} — visit {location.title}."

        media_url = None
        if payload.attach_ai_image:
            try:
                generated = generate_marketing_image(
                    location,
                    brief=topic,
                    media_category="ADDITIONAL",
                    style="marketing photo",
                    meta=meta,
                )
                media_url = generated.get("source_url")
            except Exception:
                media_url = None

        result = create_or_update_post(
            db,
            tenant_id=membership.tenant_id,
            location_id=payload.location_id,
            summary=summary,
            post_type="STANDARD",
            status="scheduled",
            cta_type="LEARN_MORE",
            cta_url=location.website,
            scheduled_for=cursor,
        )
        post_id = result.get("post", {}).get("id")
        if media_url and post_id:
            add_media(
                db,
                tenant_id=membership.tenant_id,
                location_id=payload.location_id,
                source_url=media_url,
                category="ADDITIONAL",
                caption=topic,
                media_format="PHOTO",
                post_id=post_id,
            )
        db.add(
            ScheduledJob(
                tenant_id=membership.tenant_id,
                job_type="publish_post",
                payload=json.dumps({"post_id": post_id, "topic": topic}),
                run_at=cursor,
                status="queued",
            )
        )
        created.append(
            {
                "post_id": post_id,
                "topic": topic,
                "summary": summary,
                "scheduled_for": cursor.isoformat(),
                "media_url": media_url,
            }
        )
        cursor = cursor + timedelta(days=payload.interval_days)

    db.commit()
    return {
        "created": created,
        "count": len(created),
        "stats": post_stats(db, membership.tenant_id, [payload.location_id]),
        "note": f"Scheduled {len(created)} post(s). They publish when Google live mode is on (demo keeps them as scheduled).",
    }
