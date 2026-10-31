from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_membership
from app.db.session import get_db
from app.models.business import BusinessLocation
from app.models.reviews import Review, ReviewReplyDraft
from app.models.tenant import TenantMembership
from app.services.ai.gemini import generate_json
from app.services.ai.prompts import JSON_HINTS, review_reply_prompt
from app.services.google.publisher import publish_review_reply
from app.services.workspace.scope import resolve_location_ids, review_stats, scope_reviews

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReplyGenerateRequest(BaseModel):
    review_id: str
    tone: str = "friendly"


class ReplySaveRequest(BaseModel):
    review_id: str
    reply: str = Field(min_length=2, max_length=4000)
    publish: bool = True


@router.get("")
def list_reviews(
    sentiment: str | None = None,
    answered: bool | None = None,
    min_rating: int | None = Query(default=None, ge=1, le=5),
    location_id: str | None = Query(default=None),
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    location_ids = resolve_location_ids(db, membership.tenant_id, location_id)
    query = scope_reviews(db, membership.tenant_id, location_ids)
    if sentiment:
        query = query.filter(Review.sentiment == sentiment)
    if answered is not None:
        query = query.filter(Review.is_answered.is_(answered))
    if min_rating is not None:
        query = query.filter(Review.star_rating >= min_rating)
    rows = query.order_by(Review.review_created_at.desc()).all()
    return {
        "items": [
            {
                "id": row.id,
                "reviewer_name": row.reviewer_name,
                "star_rating": row.star_rating,
                "comment": row.comment,
                "review_created_at": row.review_created_at.isoformat() if row.review_created_at else None,
                "reply_comment": row.reply_comment,
                "is_answered": row.is_answered,
                "sentiment": row.sentiment,
                "location_id": row.location_id,
            }
            for row in rows
        ],
        "stats": review_stats(db, membership.tenant_id, location_ids),
        "scope": {"location_ids": location_ids},
    }


@router.post("/generate-reply")
def generate_reply(
    payload: ReplyGenerateRequest,
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    review = (
        db.query(Review)
        .filter(Review.id == payload.review_id, Review.tenant_id == membership.tenant_id)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    location = (
        db.query(BusinessLocation)
        .filter(
            BusinessLocation.id == review.location_id,
            BusinessLocation.tenant_id == membership.tenant_id,
        )
        .first()
    )
    prompt = review_reply_prompt(
        business_name=(location.title if location else "this business"),
        category=(location.primary_category if location else None),
        tone=payload.tone,
        star_rating=review.star_rating,
        review_text=review.comment,
        existing_reply=review.reply_comment,
    )
    try:
        data = generate_json(prompt, JSON_HINTS["review_reply"])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    draft = ReviewReplyDraft(
        tenant_id=membership.tenant_id,
        review_id=review.id,
        content=data.get("reply") or "",
        tone=payload.tone,
        status="draft",
    )
    db.add(draft)
    db.commit()
    return {"draft_id": draft.id, **data}


@router.post("/reply")
def save_or_publish_reply(
    payload: ReplySaveRequest,
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    review = (
        db.query(Review)
        .filter(Review.id == payload.review_id, Review.tenant_id == membership.tenant_id)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if not payload.publish:
        draft = ReviewReplyDraft(
            tenant_id=membership.tenant_id,
            review_id=review.id,
            content=payload.reply,
            tone="manual",
            status="draft",
        )
        db.add(draft)
        review.reply_comment = payload.reply
        review.reply_updated_at = datetime.now(timezone.utc)
        db.add(review)
        db.commit()
        return {
            "review_id": review.id,
            "reply_comment": payload.reply,
            "is_answered": review.is_answered,
            "applied_locally": True,
            "pushed_to_google": False,
            "note": "Reply saved as editable draft.",
        }

    return publish_review_reply(db, review, payload.reply)
