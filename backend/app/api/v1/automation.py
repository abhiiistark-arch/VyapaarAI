import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_membership
from app.db.session import get_db
from app.models.business import BusinessLocation
from app.models.reviews import Review, ReviewAutomationRule
from app.models.tenant import TenantMembership
from app.services.ai.gemini import generate_json
from app.services.ai.prompts import JSON_HINTS, review_reply_prompt
from app.services.google.publisher import publish_review_reply
from app.services.workspace.scope import resolve_location_ids, scope_reviews

router = APIRouter(prefix="/automation", tags=["automation"])


class AutomationUpdate(BaseModel):
    enabled: bool | None = None
    auto_reply_positive: bool | None = None
    auto_ai_reply_enabled: bool | None = None
    require_approval_neutral: bool | None = None
    require_approval_negative: bool | None = None
    confidence_threshold: float | None = Field(default=None, ge=0, le=1)
    brand_tone: str | None = None
    template_positive: str | None = None
    auto_reply_min_rating: int | None = Field(default=None, ge=1, le=5)
    escalate_keywords: str | None = None
    notify_email: bool | None = None
    notify_whatsapp: bool | None = None
    schedule_posts_enabled: bool | None = None
    quiet_hours_start: str | None = None
    quiet_hours_end: str | None = None


def _get_or_create(db: Session, tenant_id: str) -> ReviewAutomationRule:
    rule = db.query(ReviewAutomationRule).filter(ReviewAutomationRule.tenant_id == tenant_id).first()
    if not rule:
        rule = ReviewAutomationRule(tenant_id=tenant_id)
        db.add(rule)
        db.commit()
        db.refresh(rule)
    return rule


def _serialize(rule: ReviewAutomationRule) -> dict:
    extras = {}
    raw = rule.template_positive or ""
    if raw.startswith("[[META]]"):
        try:
            extras = json.loads(raw.split("[[META]]", 1)[1].split("[[/META]]", 1)[0])
            template = raw.split("[[/META]]", 1)[1]
        except Exception:
            template = raw
            extras = {}
    else:
        template = raw

    return {
        "enabled": rule.enabled,
        "auto_reply_positive": rule.auto_reply_positive,
        "auto_ai_reply_enabled": extras.get("auto_ai_reply_enabled", False),
        "require_approval_neutral": rule.require_approval_neutral,
        "require_approval_negative": rule.require_approval_negative,
        "confidence_threshold": rule.confidence_threshold,
        "brand_tone": rule.brand_tone,
        "template_positive": template,
        "auto_reply_min_rating": extras.get("auto_reply_min_rating", 5),
        "escalate_keywords": extras.get(
            "escalate_keywords", "legal,lawyer,refund,food poisoning,police"
        ),
        "notify_email": extras.get("notify_email", True),
        "notify_whatsapp": extras.get("notify_whatsapp", False),
        "schedule_posts_enabled": extras.get("schedule_posts_enabled", True),
        "quiet_hours_start": extras.get("quiet_hours_start", "22:00"),
        "quiet_hours_end": extras.get("quiet_hours_end", "08:00"),
    }


def _write_template(template: str, extras: dict) -> str:
    return f"[[META]]{json.dumps(extras)}[[/META]]{template}"


def _should_auto_reply(rule_data: dict, review: Review) -> tuple[bool, str]:
    if not rule_data.get("enabled"):
        return False, "Automation master switch is off"
    if not rule_data.get("auto_ai_reply_enabled") and not rule_data.get("auto_reply_positive"):
        return False, "Auto AI reply is disabled"
    if review.is_answered:
        return False, "Already answered"

    comment = (review.comment or "").lower()
    for word in (rule_data.get("escalate_keywords") or "").split(","):
        word = word.strip().lower()
        if word and word in comment:
            return False, f"Escalated keyword: {word}"

    sentiment = (review.sentiment or "").lower()
    stars = review.star_rating or 0
    min_stars = int(rule_data.get("auto_reply_min_rating") or 5)

    if sentiment == "negative" or stars <= 2:
        if rule_data.get("require_approval_negative", True):
            return False, "Negative reviews require approval"
    if sentiment == "neutral" or stars == 3:
        if rule_data.get("require_approval_neutral", True):
            return False, "Neutral reviews require approval"

    if rule_data.get("auto_ai_reply_enabled"):
        # AI path: positive/high enough ratings (and neutrals if approval off)
        if stars < min_stars and sentiment != "positive":
            # still allow if approval requirements already passed above and AI enabled for broader set
            if stars < 4 and rule_data.get("require_approval_negative", True):
                return False, "Below auto-reply star threshold"
        return True, "ok"

    # Template-only positive path
    if rule_data.get("auto_reply_positive") and stars >= min_stars:
        return True, "ok"
    return False, "Does not match positive auto-reply rules"


@router.get("")
def get_automation(
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    rule = _get_or_create(db, membership.tenant_id)
    return _serialize(rule)


@router.put("")
def update_automation(
    payload: AutomationUpdate,
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    rule = _get_or_create(db, membership.tenant_id)
    current = _serialize(rule)

    for key in (
        "enabled",
        "auto_reply_positive",
        "require_approval_neutral",
        "require_approval_negative",
        "confidence_threshold",
        "brand_tone",
    ):
        value = getattr(payload, key)
        if value is not None:
            setattr(rule, key, value)

    extras = {
        "auto_ai_reply_enabled": payload.auto_ai_reply_enabled
        if payload.auto_ai_reply_enabled is not None
        else current["auto_ai_reply_enabled"],
        "auto_reply_min_rating": payload.auto_reply_min_rating
        if payload.auto_reply_min_rating is not None
        else current["auto_reply_min_rating"],
        "escalate_keywords": payload.escalate_keywords
        if payload.escalate_keywords is not None
        else current["escalate_keywords"],
        "notify_email": payload.notify_email if payload.notify_email is not None else current["notify_email"],
        "notify_whatsapp": payload.notify_whatsapp
        if payload.notify_whatsapp is not None
        else current["notify_whatsapp"],
        "schedule_posts_enabled": payload.schedule_posts_enabled
        if payload.schedule_posts_enabled is not None
        else current["schedule_posts_enabled"],
        "quiet_hours_start": payload.quiet_hours_start
        if payload.quiet_hours_start is not None
        else current["quiet_hours_start"],
        "quiet_hours_end": payload.quiet_hours_end
        if payload.quiet_hours_end is not None
        else current["quiet_hours_end"],
    }
    template = payload.template_positive if payload.template_positive is not None else current["template_positive"]
    rule.template_positive = _write_template(template or "", extras)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _serialize(rule)


@router.post("/run-review-replies")
def run_review_replies(
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    """Process unanswered reviews with AI (or template) according to automation toggles."""
    rule = _get_or_create(db, membership.tenant_id)
    rule_data = _serialize(rule)
    if not rule_data.get("enabled"):
        raise HTTPException(status_code=400, detail="Turn on Enable automation first")
    if not rule_data.get("auto_ai_reply_enabled") and not rule_data.get("auto_reply_positive"):
        raise HTTPException(status_code=400, detail="Enable Auto AI review replies (or positive auto-reply)")

    location_ids = resolve_location_ids(db, membership.tenant_id)
    unanswered = (
        scope_reviews(db, membership.tenant_id, location_ids)
        .filter(Review.is_answered.is_(False))
        .order_by(Review.review_created_at.desc())
        .limit(25)
        .all()
    )
    locations = {
        row.id: row
        for row in db.query(BusinessLocation)
        .filter(BusinessLocation.tenant_id == membership.tenant_id)
        .all()
    }

    results = []
    for review in unanswered:
        ok, reason = _should_auto_reply(rule_data, review)
        if not ok:
            results.append({"review_id": review.id, "status": "skipped", "reason": reason})
            continue
        location = locations.get(review.location_id)
        reply = None
        if rule_data.get("auto_ai_reply_enabled"):
            try:
                data = generate_json(
                    review_reply_prompt(
                        business_name=location.title if location else "this business",
                        category=location.primary_category if location else None,
                        tone=rule_data.get("brand_tone") or "friendly",
                        star_rating=review.star_rating,
                        review_text=review.comment,
                    ),
                    JSON_HINTS["review_reply"],
                )
                reply = data.get("reply")
            except Exception as exc:
                results.append({"review_id": review.id, "status": "error", "reason": str(exc)})
                continue
        if not reply:
            template = rule_data.get("template_positive") or "Thank you for your review!"
            reply = template.replace("{business}", location.title if location else "us")
        publish_review_reply(db, review, reply)
        results.append(
            {
                "review_id": review.id,
                "status": "replied",
                "reply": reply,
                "at": datetime.now(timezone.utc).isoformat(),
            }
        )

    replied = sum(1 for row in results if row["status"] == "replied")
    return {
        "processed": len(results),
        "replied": replied,
        "skipped": sum(1 for row in results if row["status"] == "skipped"),
        "results": results,
        "note": f"Auto-replied to {replied} review(s) using current automation rules.",
    }
