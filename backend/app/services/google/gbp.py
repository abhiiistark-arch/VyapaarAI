"""Thin Google Business Profile client. Endpoints are verified against current GBP APIs.

Account Management: mybusinessaccountmanagement.googleapis.com/v1
Business Information: mybusinessbusinessinformation.googleapis.com/v1
Reviews (v4): mybusiness.googleapis.com/v4
Local Posts (v4): mybusiness.googleapis.com/v4
Media (v4): mybusiness.googleapis.com/v4
Performance: businessprofileperformance.googleapis.com/v1
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.models.google import GoogleConnection, OAuthToken
from app.services.google import oauth

ACCOUNT_API = "https://mybusinessaccountmanagement.googleapis.com/v1"
INFO_API = "https://mybusinessbusinessinformation.googleapis.com/v1"
V4_API = "https://mybusiness.googleapis.com/v4"
PERF_API = "https://businessprofileperformance.googleapis.com/v1"


class GoogleAPIError(Exception):
    def __init__(self, status_code: int, message: str, payload: Any | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


class GBPClient:
    def __init__(self, access_token: str):
        self.access_token = access_token

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.access_token}"}

    def _get(self, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        with httpx.Client(timeout=40) as client:
            response = client.get(url, headers=self._headers(), params=params)
            if response.status_code >= 400:
                raise GoogleAPIError(response.status_code, response.text, response.text)
            return response.json() if response.content else {}

    def _post(self, url: str, json: dict[str, Any] | None = None) -> dict[str, Any]:
        with httpx.Client(timeout=40) as client:
            response = client.post(url, headers=self._headers(), json=json)
            if response.status_code >= 400:
                raise GoogleAPIError(response.status_code, response.text, response.text)
            return response.json() if response.content else {}

    def list_accounts(self) -> list[dict[str, Any]]:
        data = self._get(f"{ACCOUNT_API}/accounts")
        return data.get("accounts", [])

    def list_locations(self, account_name: str) -> list[dict[str, Any]]:
        read_mask = "name,title,storeCode,phoneNumbers,websiteUri,categories,storefrontAddress,profile"
        data = self._get(
            f"{INFO_API}/{account_name}/locations",
            params={"readMask": read_mask, "pageSize": 100},
        )
        return data.get("locations", [])

    def get_location(self, location_name: str) -> dict[str, Any]:
        read_mask = "name,title,storeCode,phoneNumbers,websiteUri,categories,storefrontAddress,profile,metadata"
        return self._get(f"{INFO_API}/{location_name}", params={"readMask": read_mask})

    def list_reviews(self, account_name: str, location_name: str) -> list[dict[str, Any]]:
        location_id = location_name.split("/")[-1]
        parent = f"{account_name}/locations/{location_id}"
        data = self._get(f"{V4_API}/{parent}/reviews")
        return data.get("reviews", [])

    def reply_to_review(self, review_name: str, comment: str) -> dict[str, Any]:
        return self._post(
            f"{V4_API}/{review_name}/reply",
            json={"comment": comment},
        )

    def list_local_posts(self, account_name: str, location_name: str) -> list[dict[str, Any]]:
        location_id = location_name.split("/")[-1]
        parent = f"{account_name}/locations/{location_id}"
        data = self._get(f"{V4_API}/{parent}/localPosts")
        return data.get("localPosts", [])

    def list_media(self, account_name: str, location_name: str) -> list[dict[str, Any]]:
        location_id = location_name.split("/")[-1]
        parent = f"{account_name}/locations/{location_id}"
        data = self._get(f"{V4_API}/{parent}/media")
        return data.get("mediaItems", []) or data.get("media", [])

    @staticmethod
    def performance_location_path(google_location_name: str) -> str:
        """Performance API wants locations/{listingId}, not accounts/.../locations/..."""
        parts = google_location_name.strip("/").split("/")
        if "locations" in parts:
            idx = parts.index("locations")
            if idx + 1 < len(parts):
                return f"locations/{parts[idx + 1]}"
        return google_location_name if google_location_name.startswith("locations/") else f"locations/{parts[-1]}"

    def fetch_multi_daily_metrics(
        self,
        google_location_name: str,
        *,
        metrics: list[str],
        start: datetime,
        end: datetime,
    ) -> dict[str, Any]:
        location = self.performance_location_path(google_location_name)
        params: list[tuple[str, str]] = []
        for metric in metrics:
            params.append(("dailyMetrics", metric))
        params.extend(
            [
                ("dailyRange.start_date.year", str(start.year)),
                ("dailyRange.start_date.month", str(start.month)),
                ("dailyRange.start_date.day", str(start.day)),
                ("dailyRange.end_date.year", str(end.year)),
                ("dailyRange.end_date.month", str(end.month)),
                ("dailyRange.end_date.day", str(end.day)),
            ]
        )
        with httpx.Client(timeout=40) as client:
            response = client.get(
                f"{PERF_API}/{location}:fetchMultiDailyMetricsTimeSeries",
                headers=self._headers(),
                params=params,
            )
            if response.status_code >= 400:
                raise GoogleAPIError(response.status_code, response.text, response.text)
            return response.json() if response.content else {}


def get_valid_client(db: Session, connection: GoogleConnection) -> GBPClient:
    token: OAuthToken | None = connection.token
    if not token:
        raise GoogleAPIError(401, "Google account is not connected")
    access, refresh = oauth.decrypted_tokens(token)
    expires = token.expires_at
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    needs_refresh = bool(expires and expires <= datetime.now(timezone.utc))
    if needs_refresh:
        if not refresh:
            raise GoogleAPIError(401, "Google session expired. Reconnect required.")
        payload = oauth.refresh_access_token(refresh)
        oauth.persist_tokens(connection, token, payload)
        db.add(token)
        db.commit()
        access, _ = oauth.decrypted_tokens(token)
    return GBPClient(access)
