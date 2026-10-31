import json

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_membership
from app.db.session import get_db
from app.models.business import BusinessAccount, BusinessLocation
from app.models.tenant import TenantMembership
from app.services.ai.gemini import GeminiError, generate_json
from app.services.ai.prompts import JSON_HINTS, demo_optimize_fallback, profile_optimize_prompt
from app.services.google.publisher import update_location_profile

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileUpdateRequest(BaseModel):
    location_id: str
    description: str | None = None
    website: str | None = None
    phone: str | None = None
    title: str | None = None
    services_text: str | None = None
    attributes_text: str | None = None
    hours: str | None = None
    primary_category: str | None = None


class OptimizeRequest(BaseModel):
    location_id: str
    focus: str = Field(
        description="description | website | services | categories | posts | attributes"
    )
    notes: str = ""


class AddBusinessRequest(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    address: str = ""
    phone: str = ""
    website: str = ""
    primary_category: str = "Restaurant"
    description: str = ""


def _meta(location: BusinessLocation) -> dict:
    if not location.metadata_json:
        return {}
    try:
        return json.loads(location.metadata_json)
    except Exception:
        return {}


def _location_payload(location: BusinessLocation) -> dict:
    meta = _meta(location)
    return {
        "id": location.id,
        "title": location.title,
        "address": location.address,
        "phone": location.phone,
        "website": location.website,
        "primary_category": location.primary_category,
        "description": location.description,
        "hours": meta.get("hours"),
        "services": meta.get("services") or [],
        "attributes": meta.get("attributes") or [],
        "is_selected": location.is_selected,
        "sync_status": location.sync_status,
    }


@router.get("/detail")
def profile_detail(
    location_id: str | None = Query(default=None),
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    query = db.query(BusinessLocation).filter(BusinessLocation.tenant_id == membership.tenant_id)
    if location_id:
        query = query.filter(BusinessLocation.id == location_id)
    else:
        query = query.filter(BusinessLocation.is_selected.is_(True))
    location = query.order_by(BusinessLocation.title.asc()).first()
    if not location:
        location = (
            db.query(BusinessLocation)
            .filter(BusinessLocation.tenant_id == membership.tenant_id)
            .order_by(BusinessLocation.title.asc())
            .first()
        )
    if not location:
        raise HTTPException(
            status_code=404,
            detail="No business found in this workspace. Connect Google or add a business in My Businesses.",
        )
    return _location_payload(location)


@router.post("/optimize")
def optimize_shortcut(
    payload: OptimizeRequest,
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    location = (
        db.query(BusinessLocation)
        .filter(
            BusinessLocation.id == payload.location_id,
            BusinessLocation.tenant_id == membership.tenant_id,
        )
        .first()
    )
    if not location:
        raise HTTPException(
            status_code=404,
            detail="Business location not found for this workspace. Connect Google or add/select a business first.",
        )

    meta = _meta(location)
    prompt = profile_optimize_prompt(
        location,
        focus=payload.focus,
        notes=payload.notes,
        meta=meta,
    )
    try:
        data = generate_json(prompt, JSON_HINTS["optimize"])
        data["source"] = "gemini"
        return {"location_id": location.id, "focus": payload.focus, "profile": _location_payload(location), **data}
    except GeminiError as exc:
        data = demo_optimize_fallback(location, payload.focus, payload.notes, meta)
        data["gemini_error"] = str(exc)[:240]
        return {"location_id": location.id, "focus": payload.focus, "profile": _location_payload(location), **data}


@router.post("/apply")
def apply_profile_update(
    payload: ProfileUpdateRequest,
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    location = (
        db.query(BusinessLocation)
        .filter(
            BusinessLocation.id == payload.location_id,
            BusinessLocation.tenant_id == membership.tenant_id,
        )
        .first()
    )
    if not location:
        raise HTTPException(status_code=404, detail="Business location not found for this workspace.")

    meta = _meta(location)
    if payload.services_text is not None:
        meta["services"] = [part.strip() for part in payload.services_text.split(",") if part.strip()]
    if payload.attributes_text is not None:
        meta["attributes"] = [part.strip() for part in payload.attributes_text.split(",") if part.strip()]
    if payload.hours is not None:
        meta["hours"] = payload.hours
    location.metadata_json = json.dumps(meta)
    if payload.primary_category is not None:
        location.primary_category = payload.primary_category

    result = update_location_profile(
        db,
        location,
        description=payload.description,
        website=payload.website,
        phone=payload.phone,
        title=payload.title,
    )
    result["profile"] = _location_payload(location)
    return result


@router.post("/businesses")
def add_business(
    payload: AddBusinessRequest,
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    from app.models.google import GoogleConnection

    account = (
        db.query(BusinessAccount)
        .filter(BusinessAccount.tenant_id == membership.tenant_id)
        .order_by(BusinessAccount.created_at.asc())
        .first()
    )
    if not account:
        connection = (
            db.query(GoogleConnection)
            .filter(GoogleConnection.tenant_id == membership.tenant_id)
            .first()
        )
        if not connection:
            connection = GoogleConnection(
                tenant_id=membership.tenant_id,
                connected_by_user_id=membership.user_id,
                google_email="manual@vyapaarai.demo",
                status="demo_manual",
                scopes="demo",
            )
            db.add(connection)
            db.flush()
        account = BusinessAccount(
            tenant_id=membership.tenant_id,
            connection_id=connection.id,
            google_account_name=f"accounts/demo-{membership.tenant_id[:8]}",
            display_name=payload.title,
            account_type="PERSONAL",
        )
        db.add(account)
        db.flush()

    location = BusinessLocation(
        tenant_id=membership.tenant_id,
        account_id=account.id,
        google_location_name=f"locations/manual-{payload.title.lower().replace(' ', '-')[:40]}",
        title=payload.title,
        address=payload.address or None,
        phone=payload.phone or None,
        website=payload.website or None,
        primary_category=payload.primary_category,
        description=payload.description or None,
        is_selected=True,
        sync_status="manual_demo",
        metadata_json=json.dumps(
            {
                "hours": "11:00 AM – 10:30 PM",
                "services": [],
                "attributes": ["Takeaway"],
            }
        ),
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return {
        **_location_payload(location),
        "note": "Saved in VyapaarAI. Link to a real Google location after GBP API approval.",
    }
