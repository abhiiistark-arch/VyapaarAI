from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class BusinessAccount(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "business_accounts"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    connection_id: Mapped[str] = mapped_column(ForeignKey("google_connections.id"), index=True)
    google_account_name: Mapped[str] = mapped_column(String(255), index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    account_type: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    role: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)

    locations = relationship("BusinessLocation", back_populates="account")


class BusinessLocation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "business_locations"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("business_accounts.id"), index=True)
    google_location_name: Mapped[str] = mapped_column(String(255), index=True)
    title: Mapped[str] = mapped_column(String(255))
    store_code: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    primary_category: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=True)
    sync_status: Mapped[str] = mapped_column(String(50), default="synced")
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    account = relationship("BusinessAccount", back_populates="locations")
