from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class BusinessPost(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "business_posts"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    location_id: Mapped[str] = mapped_column(ForeignKey("business_locations.id"), index=True)
    google_post_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    post_type: Mapped[str] = mapped_column(String(80), default="STANDARD")
    summary: Mapped[str] = mapped_column(Text)
    cta_type: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    cta_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    scheduled_for: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class PostMedia(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "post_media"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    location_id: Mapped[Optional[str]] = mapped_column(ForeignKey("business_locations.id"), nullable=True)
    post_id: Mapped[Optional[str]] = mapped_column(ForeignKey("business_posts.id"), nullable=True)
    google_media_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    media_format: Mapped[str] = mapped_column(String(50), default="PHOTO")
    category: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="local")


class ScheduledJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "scheduled_jobs"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    job_type: Mapped[str] = mapped_column(String(80))
    payload: Mapped[str] = mapped_column(Text)
    run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(String(50), default="queued")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
