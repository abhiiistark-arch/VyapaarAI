import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_membership
from app.db.session import get_db
from app.models.business import BusinessLocation
from app.models.performance import Report
from app.models.tenant import TenantMembership
from app.services.workspace.engagement import engagement_summary
from app.services.workspace.scope import media_stats, post_stats, review_stats, selected_location_ids

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("")
def analytics_overview(
    days: int = Query(default=30, ge=7, le=90),
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    location_ids = selected_location_ids(db, membership.tenant_id)
    engagement = engagement_summary(db, membership.tenant_id, location_ids, days=days)
    reviews = review_stats(db, membership.tenant_id, location_ids)
    posts = post_stats(db, membership.tenant_id, location_ids)
    media = media_stats(db, membership.tenant_id, location_ids)
    reports = (
        db.query(Report)
        .filter(Report.tenant_id == membership.tenant_id)
        .order_by(Report.created_at.desc())
        .limit(10)
        .all()
    )
    return {
        "engagement": engagement,
        "workspace": {**reviews, **posts, **media},
        "reports": [
            {
                "id": row.id,
                "title": row.title,
                "period_label": row.period_label,
                "status": row.status,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in reports
        ],
        "scope": {"location_ids": location_ids},
        "note": (
            "Demo metrics until USE_LIVE_GOOGLE=true. Then Google sync fills the same "
            "PerformanceMetric table via Business Profile Performance API."
        ),
    }


@router.post("/reports")
def create_report(
    days: int = Query(default=30, ge=7, le=90),
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    location_ids = selected_location_ids(db, membership.tenant_id)
    engagement = engagement_summary(db, membership.tenant_id, location_ids, days=days)
    reviews = review_stats(db, membership.tenant_id, location_ids)
    posts = post_stats(db, membership.tenant_id, location_ids)
    loc = None
    if location_ids:
        loc = db.query(BusinessLocation).filter(BusinessLocation.id == location_ids[0]).first()
    title = f"{(loc.title if loc else 'Workspace')} performance report"
    period = f"Last {days} days ({engagement['start_date']} → {engagement['end_date']})"
    body = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "business": loc.title if loc else None,
        "engagement": engagement,
        "reviews": reviews,
        "posts": posts,
    }
    report = Report(
        tenant_id=membership.tenant_id,
        location_id=location_ids[0] if location_ids else None,
        title=title,
        period_label=period,
        status="ready",
        summary_json=json.dumps(body),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {
        "id": report.id,
        "title": report.title,
        "period_label": report.period_label,
        "status": report.status,
        "download_path": f"/api/v1/analytics/reports/{report.id}/download",
    }


@router.get("/reports/{report_id}/download")
def download_report(
    report_id: str,
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    report = (
        db.query(Report)
        .filter(Report.id == report_id, Report.tenant_id == membership.tenant_id)
        .first()
    )
    if not report or not report.summary_json:
        return PlainTextResponse("Report not found", status_code=404)
    data = json.loads(report.summary_json)
    eng = data.get("engagement") or {}
    reviews = data.get("reviews") or {}
    posts = data.get("posts") or {}
    lines = [
        report.title,
        report.period_label,
        "",
        "== User engagement ==",
        f"Profile views: {eng.get('profile_views')}",
        f"  Search views: {eng.get('search_views')} | Maps views: {eng.get('maps_views')}",
        f"Website clicks: {eng.get('website_clicks')}",
        f"Call clicks: {eng.get('call_clicks')}",
        f"Direction requests: {eng.get('direction_requests')}",
        f"Messages: {eng.get('message_clicks')} | Menu clicks: {eng.get('menu_clicks')} | Bookings: {eng.get('bookings')}",
        f"Total actions: {eng.get('total_actions')} | Action rate: {eng.get('conversion_rate_pct')}%",
        "",
        "== Workspace ==",
        f"Reviews: {reviews.get('reviews')} (unanswered {reviews.get('unanswered_reviews')})",
        f"Avg rating: {reviews.get('average_rating')}",
        f"Posts: {posts.get('total_posts')} total / {posts.get('published_posts')} published",
        "",
        "Generated by VyapaarAI · Google Business Profile Performance metrics",
    ]
    return PlainTextResponse(
        "\n".join(lines),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="vyapaarai-report-{report_id[:8]}.txt"'},
    )
