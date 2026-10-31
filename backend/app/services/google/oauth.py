"""Google Business Profile connection via the consent / permissions page.

We do not use Google Identity Services or a Sign-in-with-Google button.
The app opens Google's OAuth consent screen directly with prompt=consent
so the user grants `business.manage` on the permissions page.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import get_settings
from app.core.security import decrypt_secret, encrypt_secret
from app.models.google import GoogleConnection, OAuthToken

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo"


def build_permissions_url(state: str) -> str:
    settings = get_settings()
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(settings.google_scope_list),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state": state,
    }
    return f"{AUTH_ENDPOINT}?{urlencode(params)}"


def new_state() -> str:
    return secrets.token_urlsafe(32)


def exchange_code(code: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise RuntimeError("Google OAuth client is not configured")
    payload = {
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": settings.google_redirect_uri,
        "grant_type": "authorization_code",
    }
    with httpx.Client(timeout=30) as client:
        response = client.post(TOKEN_ENDPOINT, data=payload)
        response.raise_for_status()
        return response.json()


def refresh_access_token(refresh_token: str) -> dict[str, Any]:
    settings = get_settings()
    payload = {
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    with httpx.Client(timeout=30) as client:
        response = client.post(TOKEN_ENDPOINT, data=payload)
        response.raise_for_status()
        return response.json()


def fetch_userinfo(access_token: str) -> dict[str, Any]:
    with httpx.Client(timeout=20) as client:
        response = client.get(
            USERINFO_ENDPOINT, headers={"Authorization": f"Bearer {access_token}"}
        )
        response.raise_for_status()
        return response.json()


def persist_tokens(connection: GoogleConnection, token: OAuthToken | None, token_payload: dict[str, Any]) -> OAuthToken:
    expires_in = int(token_payload.get("expires_in") or 3600)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    access = encrypt_secret(token_payload["access_token"])
    refresh_raw = token_payload.get("refresh_token")
    if token is None:
        token = OAuthToken(
            connection_id=connection.id,
            encrypted_access_token=access,
            encrypted_refresh_token=encrypt_secret(refresh_raw) if refresh_raw else None,
            token_type=token_payload.get("token_type", "Bearer"),
            expires_at=expires_at,
        )
    else:
        token.encrypted_access_token = access
        if refresh_raw:
            token.encrypted_refresh_token = encrypt_secret(refresh_raw)
        token.token_type = token_payload.get("token_type", "Bearer")
        token.expires_at = expires_at
    return token


def decrypted_tokens(token: OAuthToken) -> tuple[str, str | None]:
    access = decrypt_secret(token.encrypted_access_token)
    refresh = decrypt_secret(token.encrypted_refresh_token) if token.encrypted_refresh_token else None
    return access, refresh
