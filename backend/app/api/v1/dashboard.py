from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_membership
from app.db.session import get_db
from app.models.business import BusinessAccount, BusinessLocation
from app.models.google import GoogleConnection
from app.models.optimization import OptimizationTask
from app.models.tenant import TenantMembership
from app.services.workspace.engagement import engagement_summary
from app.services.workspace.scope import media_stats, post_stats, review_stats, selected_location_ids

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _parse_date(value: str | None, field: str) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {field}; use YYYY-MM-DD") from exc


@router.get("/overview")
def overview(
    days: int = Query(default=30, ge=1, le=366),
    start_date: str | None = Query(default=None, description="YYYY-MM-DD"),
    end_date: str | None = Query(default=None, description="YYYY-MM-DD"),
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id
    connection = (
        db.query(GoogleConnection)
        .filter(GoogleConnection.tenant_id == tenant_id)
        .order_by(GoogleConnection.created_at.desc())
        .first()
    )
    locations = db.query(BusinessLocation).filter(BusinessLocation.tenant_id == tenant_id)
    location_ids = selected_location_ids(db, tenant_id)
    reviews = review_stats(db, tenant_id, location_ids)
    posts = post_stats(db, tenant_id, location_ids)
    media = media_stats(db, tenant_id, location_ids)
    start = _parse_date(start_date, "start_date")
    end = _parse_date(end_date, "end_date")
    engagement = engagement_summary(
        db,
        tenant_id,
        location_ids,
        days=days,
        start_date=start,
        end_date=end,
    )
    tasks = (
        db.query(OptimizationTask)
        .filter(OptimizationTask.tenant_id == tenant_id, OptimizationTask.status == "open")
        .order_by(OptimizationTask.sort_order.asc())
        .limit(8)
        .all()
    )

    return {
        "connection": {
            "status": connection.status if connection else "disconnected",
            "google_email": connection.google_email if connection else None,
            "last_synced_at": connection.last_synced_at.isoformat() if connection and connection.last_synced_at else None,
            "last_error": connection.last_error if connection else None,
        },
        "engagement": engagement,
        "stats": {
            "businesses": db.query(BusinessAccount).filter(BusinessAccount.tenant_id == tenant_id).count(),
            "locations": len(location_ids),
            "reviews": reviews["reviews"],
            "average_rating": reviews["average_rating"],
            "unanswered_reviews": reviews["unanswered_reviews"],
            "total_posts": posts["total_posts"],
            "published_posts": posts["published_posts"],
            "scheduled_posts": posts["scheduled_posts"],
            "draft_posts": posts["draft_posts"],
            "pending_sync_posts": posts["pending_sync_posts"],
            "photos": media["photos"],
            "videos": media["videos"],
            "pending_tasks": db.query(OptimizationTask)
            .filter(OptimizationTask.tenant_id == tenant_id, OptimizationTask.status == "open")
            .count(),
        },
        "scope": {
            "location_ids": location_ids,
            "note": "Stats use the same selected-location scope as Posts & Reviews.",
            "engagement_start": engagement.get("start_date"),
            "engagement_end": engagement.get("end_date"),
        },
        "tasks": [
            {
                "id": task.id,
                "title": task.title,
                "description": task.description,
                "priority": task.priority,
                "expected_benefit": task.expected_benefit,
            }
            for task in tasks
        ],
        "locations": [
            {
                "id": row.id,
                "title": row.title,
                "address": row.address,
                "primary_category": row.primary_category,
                "is_selected": row.is_selected,
            }
            for row in locations.order_by(BusinessLocation.title.asc()).all()
        ],
    }
