from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Review(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reviews"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    location_id: Mapped[str] = mapped_column(ForeignKey("business_locations.id"), index=True)
    google_review_name: Mapped[str] = mapped_column(String(255), unique=True)
    reviewer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    star_rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    review_created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reply_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reply_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_answered: Mapped[bool] = mapped_column(Boolean, default=False)
    sentiment: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)


class ReviewSentiment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "review_sentiments"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    review_id: Mapped[str] = mapped_column(ForeignKey("reviews.id"), unique=True)
    label: Mapped[str] = mapped_column(String(50))
    confidence: Mapped[float] = mapped_column(Float, default=0)
    themes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class ReviewReplyDraft(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "review_reply_drafts"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    review_id: Mapped[str] = mapped_column(ForeignKey("reviews.id"), index=True)
    content: Mapped[str] = mapped_column(Text)
    tone: Mapped[str] = mapped_column(String(50), default="professional")
    status: Mapped[str] = mapped_column(String(50), default="draft")
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)


class ReviewAutomationRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "review_automation_rules"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), unique=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_reply_positive: Mapped[bool] = mapped_column(Boolean, default=False)
    require_approval_neutral: Mapped[bool] = mapped_column(Boolean, default=True)
    require_approval_negative: Mapped[bool] = mapped_column(Boolean, default=True)
    confidence_threshold: Mapped[float] = mapped_column(Float, default=0.8)
    brand_tone: Mapped[str] = mapped_column(String(50), default="professional")
    template_positive: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class ReviewInvitation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "review_invitations"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    location_id: Mapped[str] = mapped_column(ForeignKey("business_locations.id"), index=True)
    channel: Mapped[str] = mapped_column(String(50))
    recipient: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    message: Mapped[str] = mapped_column(Text)
    review_link: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(50), default="created")
