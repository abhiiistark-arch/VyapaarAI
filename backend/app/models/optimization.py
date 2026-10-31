from typing import Optional

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class BusinessAudit(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "business_audits"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    location_id: Mapped[str] = mapped_column(ForeignKey("business_locations.id"), index=True)
    overall_score: Mapped[float] = mapped_column(Float, default=0)
    completeness_score: Mapped[float] = mapped_column(Float, default=0)
    reviews_score: Mapped[float] = mapped_column(Float, default=0)
    photos_score: Mapped[float] = mapped_column(Float, default=0)
    posting_score: Mapped[float] = mapped_column(Float, default=0)
    findings_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class SeoKeyword(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "seo_keywords"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    location_id: Mapped[Optional[str]] = mapped_column(ForeignKey("business_locations.id"), nullable=True)
    keyword: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(80))
    rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class OptimizationTask(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "optimization_tasks"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    location_id: Mapped[Optional[str]] = mapped_column(ForeignKey("business_locations.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(50), default="medium")
    expected_benefit: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="open")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
