from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.business import BusinessAccount, BusinessLocation
from app.models.google import GoogleConnection
from app.models.performance import PerformanceMetric
from app.models.posts import BusinessPost, PostMedia
from app.models.reviews import Review
from app.services.google.gbp import GBPClient, GoogleAPIError, get_valid_client
from app.services.workspace.engagement import ALL_ENGAGEMENT_METRICS
from app.services.workspace.scope import STATUS_PUBLISHED


def _parse_dated_value(dated: dict) -> tuple[date | None, float]:
    value = dated.get("value")
    try:
        numeric = float(value) if value is not None else 0.0
    except (TypeError, ValueError):
        numeric = 0.0
    d = dated.get("date") or {}
    try:
        return date(int(d["year"]), int(d["month"]), int(d["day"])), numeric
    except Exception:
        return None, numeric


def upsert_performance_from_remote(
    db: Session,
    *,
    tenant_id: str,
    location_id: str,
    payload: dict,
) -> int:
    """Persist fetchMultiDailyMetricsTimeSeries response into PerformanceMetric."""
    count = 0
    for multi in payload.get("multiDailyMetricTimeSeries") or []:
        for daily in multi.get("dailyMetricTimeSeries") or []:
            metric_name = daily.get("dailyMetric")
            if not metric_name:
                continue
            series = (daily.get("timeSeries") or {}).get("datedValues") or []
            for dated in series:
                metric_day, value = _parse_dated_value(dated)
                if not metric_day:
                    continue
                row = (
                    db.query(PerformanceMetric)
                    .filter(
                        PerformanceMetric.tenant_id == tenant_id,
                        PerformanceMetric.location_id == location_id,
                        PerformanceMetric.metric_date == metric_day,
                        PerformanceMetric.metric_name == metric_name,
                    )
                    .first()
                )
                if not row:
                    row = PerformanceMetric(
                        tenant_id=tenant_id,
                        location_id=location_id,
                        metric_date=metric_day,
                        metric_name=metric_name,
                    )
                    db.add(row)
                row.metric_value = value
                count += 1
    return count


def _address_text(location: dict) -> str | None:
    address = location.get("storefrontAddress") or {}
    lines = address.get("addressLines") or []
    parts = [
        *lines,
        address.get("locality"),
        address.get("administrativeArea"),
        address.get("postalCode"),
        address.get("regionCode"),
    ]
    text = ", ".join([part for part in parts if part])
    return text or None


def sync_accounts_and_locations(db: Session, connection: GoogleConnection) -> dict:
    client: GBPClient = get_valid_client(db, connection)
    accounts = client.list_accounts()
    created_accounts = 0
    created_locations = 0

    for account in accounts:
        name = account.get("name")
        if not name:
            continue
        row = (
            db.query(BusinessAccount)
            .filter(
                BusinessAccount.tenant_id == connection.tenant_id,
                BusinessAccount.google_account_name == name,
            )
            .first()
        )
        if not row:
            row = BusinessAccount(
                tenant_id=connection.tenant_id,
                connection_id=connection.id,
                google_account_name=name,
                display_name=account.get("accountName") or name,
                account_type=account.get("type"),
                role=account.get("role") or account.get("permissionLevel"),
            )
            db.add(row)
            db.flush()
            created_accounts += 1
        else:
            row.display_name = account.get("accountName") or row.display_name
            row.account_type = account.get("type") or row.account_type

        try:
            locations = client.list_locations(name)
        except GoogleAPIError:
            locations = []

        for location in locations:
            loc_name = location.get("name")
            if not loc_name:
                continue
            loc_row = (
                db.query(BusinessLocation)
                .filter(
                    BusinessLocation.tenant_id == connection.tenant_id,
                    BusinessLocation.google_location_name == loc_name,
                )
                .first()
            )
            categories = location.get("categories") or {}
            primary = (categories.get("primaryCategory") or {}).get("displayName")
            phones = location.get("phoneNumbers") or {}
            profile = location.get("profile") or {}
            values = {
                "title": location.get("title") or "Untitled location",
                "store_code": location.get("storeCode"),
                "address": _address_text(location),
                "phone": phones.get("primaryPhone"),
                "website": location.get("websiteUri"),
                "primary_category": primary,
                "description": profile.get("description"),
                "metadata_json": json.dumps(location),
                "sync_status": "synced",
            }
            if not loc_row:
                loc_row = BusinessLocation(
                    tenant_id=connection.tenant_id,
                    account_id=row.id,
                    google_location_name=loc_name,
                    is_selected=True,
                    **values,
                )
                db.add(loc_row)
                created_locations += 1
            else:
                for key, value in values.items():
                    setattr(loc_row, key, value)

    posts_upserted = 0
    media_upserted = 0
    reviews_upserted = 0
    metrics_upserted = 0

    # After locations exist, pull GBP posts / media / reviews / performance into
    # the same tables the dashboard already uses — keeps counts consistent when live.
    location_rows = (
        db.query(BusinessLocation)
        .filter(BusinessLocation.tenant_id == connection.tenant_id)
        .all()
    )
    account_by_id = {
        row.id: row
        for row in db.query(BusinessAccount)
        .filter(BusinessAccount.tenant_id == connection.tenant_id)
        .all()
    }
    for loc_row in location_rows:
        account = account_by_id.get(loc_row.account_id)
        if not account or not loc_row.google_location_name or not account.google_account_name:
            continue
        try:
            remote_posts = client.list_local_posts(
                account.google_account_name, loc_row.google_location_name
            )
        except GoogleAPIError:
            remote_posts = []
        for remote in remote_posts:
            name = remote.get("name")
            if not name:
                continue
            summary = (remote.get("summary") or remote.get("name") or "").strip() or "Google post"
            post = (
                db.query(BusinessPost)
                .filter(
                    BusinessPost.tenant_id == connection.tenant_id,
                    BusinessPost.google_post_name == name,
                )
                .first()
            )
            state = (remote.get("state") or "LIVE").upper()
            status = STATUS_PUBLISHED if state in {"LIVE", "PUBLISHED"} else "draft"
            call_to_action = remote.get("callToAction") or {}
            if not post:
                post = BusinessPost(
                    tenant_id=connection.tenant_id,
                    location_id=loc_row.id,
                    google_post_name=name,
                )
                db.add(post)
            post.location_id = loc_row.id
            post.summary = summary
            post.post_type = remote.get("topicType") or post.post_type or "STANDARD"
            post.status = status
            post.cta_type = call_to_action.get("actionType") or post.cta_type
            post.cta_url = call_to_action.get("url") or post.cta_url
            if status == STATUS_PUBLISHED and not post.published_at:
                post.published_at = datetime.now(timezone.utc)
            posts_upserted += 1

        try:
            remote_media = client.list_media(
                account.google_account_name, loc_row.google_location_name
            )
        except GoogleAPIError:
            remote_media = []
        for remote in remote_media:
            name = remote.get("name")
            source = (remote.get("googleUrl") or remote.get("thumbnailUrl") or "").strip()
            if not name and not source:
                continue
            media = None
            if name:
                media = (
                    db.query(PostMedia)
                    .filter(
                        PostMedia.tenant_id == connection.tenant_id,
                        PostMedia.google_media_name == name,
                    )
                    .first()
                )
            if not media and source:
                media = (
                    db.query(PostMedia)
                    .filter(
                        PostMedia.tenant_id == connection.tenant_id,
                        PostMedia.source_url == source,
                    )
                    .first()
                )
            fmt = (remote.get("mediaFormat") or "PHOTO").upper()
            if fmt not in {"PHOTO", "VIDEO"}:
                fmt = "PHOTO"
            if not media:
                media = PostMedia(
                    tenant_id=connection.tenant_id,
                    location_id=loc_row.id,
                    google_media_name=name,
                )
                db.add(media)
            media.location_id = loc_row.id
            media.google_media_name = name or media.google_media_name
            media.source_url = source or media.source_url
            media.media_format = fmt
            media.category = remote.get("locationAssociation", {}).get("category") or media.category or "ADDITIONAL"
            media.status = "synced"
            media_upserted += 1

        try:
            remote_reviews = client.list_reviews(
                account.google_account_name, loc_row.google_location_name
            )
        except GoogleAPIError:
            remote_reviews = []
        for remote in remote_reviews:
            name = remote.get("name")
            if not name:
                continue
            review = (
                db.query(Review)
                .filter(
                    Review.tenant_id == connection.tenant_id,
                    Review.google_review_name == name,
                )
                .first()
            )
            star_map = {"ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5}
            stars = remote.get("starRating")
            rating = star_map.get(str(stars).upper(), stars if isinstance(stars, int) else 5)
            reply = (remote.get("reviewReply") or {}).get("comment")
            reviewer = (remote.get("reviewer") or {}).get("displayName") or "Google user"
            if not review:
                review = Review(
                    tenant_id=connection.tenant_id,
                    location_id=loc_row.id,
                    google_review_name=name,
                )
                db.add(review)
            review.location_id = loc_row.id
            review.reviewer_name = reviewer
            review.star_rating = int(rating or 5)
            review.comment = remote.get("comment")
            review.reply_comment = reply
            review.is_answered = bool(reply)
            review.sentiment = (
                "positive" if review.star_rating >= 4 else ("neutral" if review.star_rating == 3 else "negative")
            )
            reviews_upserted += 1

        # Engagement / performance (profile views, calls, website clicks, directions…)
        try:
            end = datetime.now(timezone.utc)
            start = end - timedelta(days=30)
            perf_payload = client.fetch_multi_daily_metrics(
                loc_row.google_location_name,
                metrics=list(ALL_ENGAGEMENT_METRICS),
                start=start,
                end=end,
            )
            metrics_upserted += upsert_performance_from_remote(
                db,
                tenant_id=connection.tenant_id,
                location_id=loc_row.id,
                payload=perf_payload,
            )
        except GoogleAPIError:
            pass

    connection.last_synced_at = datetime.now(timezone.utc)
    connection.status = "connected"
    connection.last_error = None
    db.commit()
    return {
        "accounts": created_accounts,
        "locations": created_locations,
        "account_count": len(accounts),
        "posts_upserted": posts_upserted,
        "media_upserted": media_upserted,
        "reviews_upserted": reviews_upserted,
        "metrics_upserted": metrics_upserted,
    }
