"""Seed rich demo data for Rajveer Chinese (Vadjal, Satara) from chinese_web.

Used while GBP API approval is pending. Flip DEMO_MODE=false and USE_LIVE_GOOGLE=true
when Google grants access — no code rewrite needed for the switch.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.business import BusinessAccount, BusinessLocation
from app.models.google import GoogleConnection
from app.models.optimization import BusinessAudit, OptimizationTask, SeoKeyword
from app.models.performance import PerformanceMetric
from app.models.posts import BusinessPost
from app.models.reviews import Review, ReviewAutomationRule, ReviewSentiment
from app.models.tenant import Subscription, Tenant, TenantMembership
from app.models.user import User

DEMO_EMAIL = "owner@rajveerchinese.demo"
DEMO_PASSWORD = "vyapaarai123"


def seed_demo_workspace(db: Session) -> dict:
    existing = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if existing:
        membership = (
            db.query(TenantMembership).filter(TenantMembership.user_id == existing.id).first()
        )
        return {
            "seeded": False,
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD,
            "tenant_id": membership.tenant_id if membership else None,
            "message": "Demo workspace already exists",
        }

    user = User(
        email=DEMO_EMAIL,
        hashed_password=hash_password(DEMO_PASSWORD),
        full_name="Rajveer Chinese Owner",
        brand_tone="friendly",
    )
    db.add(user)
    db.flush()

    tenant = Tenant(name="Rajveer Chinese", slug="rajveer-chinese", plan="growth")
    db.add(tenant)
    db.flush()
    db.add(TenantMembership(user_id=user.id, tenant_id=tenant.id, role="owner"))
    db.add(
        Subscription(
            tenant_id=tenant.id,
            plan="growth",
            location_limit=10,
            review_automation_enabled=True,
            status="active",
        )
    )

    connection = GoogleConnection(
        tenant_id=tenant.id,
        connected_by_user_id=user.id,
        google_email="rajveer.chinese.vadjal@gmail.com",
        google_account_id="demo-google-account-rajveer",
        status="connected",
        scopes="demo",
        last_synced_at=datetime.now(timezone.utc),
    )
    db.add(connection)
    db.flush()

    account = BusinessAccount(
        tenant_id=tenant.id,
        connection_id=connection.id,
        google_account_name="accounts/demo-rajveer",
        display_name="Rajveer Chinese",
        account_type="PERSONAL",
        role="PRIMARY_OWNER",
    )
    db.add(account)
    db.flush()

    description = (
        "At Rajveer Chinese we keep it simple: fresh ingredients, a hot wok, "
        "and flavours that hit the spot every time. Whether you’re craving noodles "
        "after school or a full Indo-Chinese spread with family, we’re here in Vadjal for you. "
        "Dine in · Takeaway · Family portions."
    )
    location = BusinessLocation(
        tenant_id=tenant.id,
        account_id=account.id,
        google_location_name="locations/demo-rajveer-vadjal",
        title="Rajveer Chinese",
        store_code="RJ-VAD-01",
        address="Mayani, Mhaswad Road, Near Yashvantrao Chavan High School, Vadjal, Satara, Maharashtra 415509",
        phone="+91 98765 43210",
        website="https://rajveerchinese.local",
        primary_category="Chinese restaurant",
        description=description,
        is_selected=True,
        sync_status="demo",
        metadata_json=json.dumps(
            {
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
        ),
    )
    db.add(location)
    db.flush()

    now = datetime.now(timezone.utc)
    review_rows = [
        ("Priya Deshmukh", 5, "Best Hakka noodles in Vadjal! Fresh, spicy, and quick takeaway near the school.", -2, True, "Thank you Priya! Glad the Hakka noodles hit the spot. See you again soon."),
        ("Amit Jadhav", 5, "Chilli paneer was excellent. Family portions are generous. Highly recommend Rajveer Chinese.", -5, True, "Thanks Amit! Family portions are our speciality — come hungry next time too."),
        ("Sneha Patil", 4, "Manchurian gravy is tangy and crispy. Parking is a bit tight on weekends.", -8, False, None),
        ("Rohan Kulkarni", 5, "Schezwan fried rice with perfect heat. Open late which helps after evening tuition.", -1, True, "Appreciate it Rohan! We’re open till 10:30 PM every day."),
        ("Meera Shah", 3, "Food was good but wait time was long on Saturday evening. Please improve service speed.", -3, False, None),
        ("Vikas More", 2, "Ordered chilli paneer takeaway — arrived lukewarm. Taste was okay but temperature disappointed.", -4, False, None),
        ("Ananya Joshi", 5, "Hot & sour soup and spring rolls are amazing starters. Kids loved the noodles.", -6, True, "So happy the kids enjoyed it, Ananya! Hot & sour is a house favourite."),
        ("Sagar Pawar", 4, "Authentic Indo-Chinese flavours. Near Yashvantrao Chavan High School — very convenient.", -10, False, None),
        ("Kavita Rane", 1, "Wrong order delivered once. Staff apologised but it ruined dinner plans.", -7, False, None),
        ("Nikhil Shinde", 5, "Best Chinese stop in Satara side. Bold flavours, fresh wok, fair prices.", -12, True, "Thank you Nikhil! Fresh wok, every plate — that’s our promise."),
        ("Pooja Ghule", 4, "Veg Manchurian dumplings were crispy. Would love more dessert options though.", -14, False, None),
        ("Aditya Salunkhe", 5, "Came from Mhaswad Road specifically for Schezwan specials. Worth the drive!", -16, True, "Worth the drive means everything to us. Welcome back anytime, Aditya."),
    ]

    for idx, (name, stars, comment, days_ago, answered, reply) in enumerate(review_rows):
        created = now + timedelta(days=days_ago)
        review = Review(
            tenant_id=tenant.id,
            location_id=location.id,
            google_review_name=f"reviews/demo-rajveer-{idx+1}",
            reviewer_name=name,
            star_rating=stars,
            comment=comment,
            review_created_at=created,
            reply_comment=reply,
            reply_updated_at=created + timedelta(hours=6) if reply else None,
            is_answered=answered,
            sentiment="positive" if stars >= 4 else ("neutral" if stars == 3 else "negative"),
        )
        db.add(review)
        db.flush()
        db.add(
            ReviewSentiment(
                tenant_id=tenant.id,
                review_id=review.id,
                label=review.sentiment or "neutral",
                confidence=0.91 if stars >= 4 else 0.84,
                themes=json.dumps(
                    ["taste", "speed"] if stars >= 4 else ["service", "temperature", "order accuracy"]
                ),
                summary=comment[:120],
            )
        )

    posts = [
        ("STANDARD", "Crispy Veg Manchurian just off the wok — tangy Indo-Chinese gravy, made to order in Vadjal.", "published", -1),
        ("STANDARD", "Craving Hakka Noodles after school? We’re open till 10:30 PM on Mayani–Mhaswad Road.", "published", -4),
        ("OFFER", "Family feast night: share Schezwan specials + fried rice. Ask for your spice level!", "scheduled", 2),
        ("STANDARD", "Hot & sour soup and spring rolls — the starters locals come back for.", "draft", None),
        ("EVENT", "Weekend rush hours: order ahead for takeaway near Yashvantrao Chavan High School.", "published", -9),
    ]
    for post_type, summary, status, offset in posts:
        scheduled = now + timedelta(days=offset) if offset and status == "scheduled" else None
        published = now + timedelta(days=offset) if offset and status == "published" else None
        db.add(
            BusinessPost(
                tenant_id=tenant.id,
                location_id=location.id,
                google_post_name=f"localPosts/demo-{status}-{abs(offset or 0)}",
                post_type=post_type,
                summary=summary,
                cta_type="LEARN_MORE",
                cta_url="https://maps.google.com/?q=Rajveer+Chinese+Vadjal",
                status=status,
                scheduled_for=scheduled,
                published_at=published,
            )
        )

    unanswered = (
        db.query(Review)
        .filter(Review.tenant_id == tenant.id, Review.is_answered.is_(False))
        .count()
    )
    published_count = (
        db.query(BusinessPost)
        .filter(BusinessPost.tenant_id == tenant.id, BusinessPost.status == "published")
        .count()
    )
    draft_count = (
        db.query(BusinessPost)
        .filter(BusinessPost.tenant_id == tenant.id, BusinessPost.status == "draft")
        .count()
    )
    tasks = [
        (
            "Respond to unanswered reviews",
            f"{unanswered} reviews still need a reply, including low-star feedback.",
            "high",
            "Protect rating & trust",
        ),
        (
            "Refresh Google Posts",
            f"{published_count} published and {draft_count} draft post(s) on file — keep the feed active this week.",
            "medium",
            "Visibility",
        ),
        ("Add dessert / beverage services", "Customers asked for dessert options — add supported services if available.", "low", "Profile completeness"),
        ("Upload fresh food photos", "Add Manchurian, Hakka noodles, and chilli paneer photos from the wok.", "medium", "Click-through"),
        ("Tighten weekend staffing note", "Mention peak-hour takeaway wait in description to set expectations.", "medium", "Fewer 3-star service complaints"),
    ]
    for i, (title, desc, priority, benefit) in enumerate(tasks):
        db.add(
            OptimizationTask(
                tenant_id=tenant.id,
                location_id=location.id,
                title=title,
                description=desc,
                priority=priority,
                expected_benefit=benefit,
                status="open",
                sort_order=i,
            )
        )

    keywords = [
        ("chinese restaurant vadjal", "primary"),
        ("indo chinese satara", "location"),
        ("hakka noodles near me", "service"),
        ("manchurian vadjal", "service"),
        ("best chinese food mhaswad road", "long_tail"),
        ("schezwan fried rice satara", "secondary"),
        ("chilli paneer takeaway vadjal", "long_tail"),
    ]
    for word, category in keywords:
        db.add(
            SeoKeyword(
                tenant_id=tenant.id,
                location_id=location.id,
                keyword=word,
                category=category,
                rationale="Derived from Rajveer Chinese menu + Vadjal local intent",
            )
        )

    db.add(
        BusinessAudit(
            tenant_id=tenant.id,
            location_id=location.id,
            overall_score=82,
            completeness_score=88,
            reviews_score=79,
            photos_score=70,
            posting_score=76,
            findings_json=json.dumps(
                {
                    "strengths": ["Strong category", "Clear address", "Active reviews"],
                    "gaps": ["More food photos", "Faster negative-review replies", "Dessert services"],
                    "label": "VyapaarAI score — not an official Google ranking",
                }
            ),
        )
    )

    # Demo engagement mirrors Business Profile Performance API DailyMetrics.
    for day in range(60):
        metric_day = (now - timedelta(days=day)).date()
        wave = day % 7
        for name, base in [
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
        ]:
            db.add(
                PerformanceMetric(
                    tenant_id=tenant.id,
                    location_id=location.id,
                    metric_date=metric_day,
                    metric_name=name,
                    metric_value=float(base + wave * 3 + (day % 5)),
                )
            )

    db.add(
        ReviewAutomationRule(
            tenant_id=tenant.id,
            enabled=True,
            auto_reply_positive=False,
            require_approval_neutral=True,
            require_approval_negative=True,
            confidence_threshold=0.85,
            brand_tone="friendly",
            template_positive="Thank you for visiting Rajveer Chinese in Vadjal! We’re glad you enjoyed your meal.",
        )
    )

    db.commit()
    return {
        "seeded": True,
        "email": DEMO_EMAIL,
        "password": DEMO_PASSWORD,
        "tenant_id": tenant.id,
        "business": "Rajveer Chinese",
        "message": "Demo workspace ready",
    }
