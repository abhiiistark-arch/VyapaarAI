from datetime import date
from typing import Optional

from sqlalchemy import Date, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PerformanceMetric(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "performance_metrics"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    location_id: Mapped[str] = mapped_column(ForeignKey("business_locations.id"), index=True)
    metric_date: Mapped[date] = mapped_column(Date, index=True)
    metric_name: Mapped[str] = mapped_column(String(120))
    metric_value: Mapped[float] = mapped_column(Float, default=0)


class Report(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reports"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    location_id: Mapped[Optional[str]] = mapped_column(ForeignKey("business_locations.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    period_label: Mapped[str] = mapped_column(String(80))
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="ready")
    summary_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
