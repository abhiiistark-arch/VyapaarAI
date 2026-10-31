from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_membership, get_current_user
from app.core.security import create_access_token, decode_access_token
from app.db.session import get_db
from app.models.business import BusinessLocation
from app.models.google import GoogleConnection
from app.models.tenant import TenantMembership
from app.models.user import User
from app.services.google import oauth
from app.services.google.gbp import GoogleAPIError
from app.services.google.sync import sync_accounts_and_locations

router = APIRouter(prefix="/google", tags=["google"])


class ConnectResponse(BaseModel):
    permissions_url: str
    configured: bool
    message: str


class LocationSelectRequest(BaseModel):
    location_ids: list[str]


@router.get("/connect", response_model=ConnectResponse)
def connect_google(
    current_user: User = Depends(get_current_user),
    membership: TenantMembership = Depends(get_current_membership),
):
    settings = get_settings()
    if settings.demo_mode or not settings.google_live_enabled:
        return ConnectResponse(
            permissions_url="",
            configured=False,
            message=(
                "Demo mode is on — sample business data is loaded locally for testing. "
                "When Google approves GBP APIs, set DEMO_MODE=false, USE_LIVE_GOOGLE=true, "
                "and add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to connect any Google Business Profile."
            ),
        )
    state = create_access_token(
        current_user.id,
        {"tenant_id": membership.tenant_id, "purpose": "google_connect"},
    )
    url = oauth.build_permissions_url(state)
    return ConnectResponse(
        permissions_url=url,
        configured=True,
        message="Opening Google permissions page to grant Business Profile access.",
    )


@router.get("/callback")
def google_callback(code: str | None = None, state: str | None = None, error: str | None = None, db: Session = Depends(get_db)):
    settings = get_settings()
    frontend = settings.frontend_url.rstrip("/")
    if error:
        return RedirectResponse(f"{frontend}/connect?error={error}")
    if not code or not state:
        return RedirectResponse(f"{frontend}/connect?error=missing_code")
    try:
        payload = decode_access_token(state)
        if payload.get("purpose") != "google_connect":
            raise ValueError("Invalid state")
        user_id = payload["sub"]
        tenant_id = payload["tenant_id"]
        token_payload = oauth.exchange_code(code)
        userinfo = oauth.fetch_userinfo(token_payload["access_token"])
    except Exception:
        return RedirectResponse(f"{frontend}/connect?error=google_exchange_failed")

    connection = (
        db.query(GoogleConnection)
        .filter(GoogleConnection.tenant_id == tenant_id)
        .order_by(GoogleConnection.created_at.desc())
        .first()
    )
    if not connection:
        connection = GoogleConnection(
            tenant_id=tenant_id,
            connected_by_user_id=user_id,
        )
        db.add(connection)
        db.flush()

    connection.google_email = userinfo.get("email")
    connection.google_account_id = str(userinfo.get("id") or "")
    connection.scopes = " ".join(settings.google_scope_list)
    connection.status = "connected"
    token = oauth.persist_tokens(connection, connection.token, token_payload)
    db.add(token)
    db.commit()

    try:
        sync_accounts_and_locations(db, connection)
    except GoogleAPIError as exc:
        connection.last_error = str(exc)
        db.commit()
        return RedirectResponse(f"{frontend}/connect?error=sync_failed")

    return RedirectResponse(f"{frontend}/connect?connected=1")


@router.post("/sync")
def sync_google(
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    connection = (
        db.query(GoogleConnection)
        .filter(GoogleConnection.tenant_id == membership.tenant_id, GoogleConnection.status == "connected")
        .first()
    )
    if not connection:
        raise HTTPException(status_code=400, detail="Google Business Profile is not connected")
    try:
        result = sync_accounts_and_locations(db, connection)
    except GoogleAPIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return result


@router.get("/locations")
def list_locations(
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    import json

    rows = (
        db.query(BusinessLocation)
        .filter(BusinessLocation.tenant_id == membership.tenant_id)
        .order_by(BusinessLocation.title.asc())
        .all()
    )
    payload = []
    for row in rows:
        meta = {}
        if row.metadata_json:
            try:
                meta = json.loads(row.metadata_json)
            except Exception:
                meta = {}
        payload.append(
            {
                "id": row.id,
                "title": row.title,
                "address": row.address,
                "phone": row.phone,
                "website": row.website,
                "primary_category": row.primary_category,
                "description": row.description,
                "hours": meta.get("hours"),
                "services": meta.get("services") or [],
                "attributes": meta.get("attributes") or [],
                "is_selected": row.is_selected,
                "sync_status": row.sync_status,
            }
        )
    return payload


@router.post("/locations/select")
def select_locations(
    payload: LocationSelectRequest,
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    rows = db.query(BusinessLocation).filter(BusinessLocation.tenant_id == membership.tenant_id).all()
    selected = set(payload.location_ids)
    for row in rows:
        row.is_selected = row.id in selected
    db.commit()
    return {"selected": len(selected)}


@router.post("/disconnect")
def disconnect(
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    connection = (
        db.query(GoogleConnection)
        .filter(GoogleConnection.tenant_id == membership.tenant_id)
        .first()
    )
    if connection:
        connection.status = "revoked"
        db.commit()
    return {"status": "revoked"}
