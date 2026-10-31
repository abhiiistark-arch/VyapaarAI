from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Tenant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    plan: Mapped[str] = mapped_column(String(50), default="starter")
    status: Mapped[str] = mapped_column(String(50), default="active")

    memberships = relationship("TenantMembership", back_populates="tenant")
    subscription = relationship("Subscription", back_populates="tenant", uselist=False)


class TenantMembership(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tenant_memberships"
    __table_args__ = (UniqueConstraint("user_id", "tenant_id", name="uq_membership_user_tenant"),)

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    role: Mapped[str] = mapped_column(String(50), default="owner")
    status: Mapped[str] = mapped_column(String(50), default="active")

    user = relationship("User", back_populates="memberships")
    tenant = relationship("Tenant", back_populates="memberships")


class Subscription(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "subscriptions"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), unique=True)
    plan: Mapped[str] = mapped_column(String(50), default="starter")
    location_limit: Mapped[int] = mapped_column(default=5)
    review_automation_enabled: Mapped[bool] = mapped_column(default=False)
    status: Mapped[str] = mapped_column(String(50), default="trial")
    renews_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    tenant = relationship("Tenant", back_populates="subscription")
