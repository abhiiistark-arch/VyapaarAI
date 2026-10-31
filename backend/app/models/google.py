from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class GoogleConnection(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "google_connections"

    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    connected_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    google_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    google_account_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    scopes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    token = relationship("OAuthToken", back_populates="connection", uselist=False)


class OAuthToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "oauth_tokens"

    connection_id: Mapped[str] = mapped_column(ForeignKey("google_connections.id"), unique=True)
    encrypted_access_token: Mapped[str] = mapped_column(Text)
    encrypted_refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_type: Mapped[str] = mapped_column(String(50), default="Bearer")
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    connection = relationship("GoogleConnection", back_populates="token")
