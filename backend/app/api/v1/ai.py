import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_membership
from app.db.session import get_db
from app.models.business import BusinessLocation
from app.models.tenant import TenantMembership
from app.services.ai.gemini import generate_json, generate_text
from app.services.ai.prompts import JSON_HINTS, assistant_prompt, description_prompt

router = APIRouter(prefix="/ai", tags=["ai"])


class DescriptionRequest(BaseModel):
    location_id: str
    extra_notes: str = ""


class AssistantRequest(BaseModel):
    message: str
    location_id: str | None = None


def _meta(location: BusinessLocation) -> dict:
    if not location.metadata_json:
        return {}
    try:
        return json.loads(location.metadata_json)
    except Exception:
        return {}


@router.post("/description")
def generate_description(
    payload: DescriptionRequest,
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
        raise HTTPException(status_code=404, detail="Location not found")
    prompt = description_prompt(location, notes=payload.extra_notes, meta=_meta(location))
    try:
        return generate_json(prompt, JSON_HINTS["description"])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/assistant")
def assistant(
    payload: AssistantRequest,
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    query = db.query(BusinessLocation).filter(BusinessLocation.tenant_id == membership.tenant_id)
    if payload.location_id:
        query = query.filter(BusinessLocation.id == payload.location_id)
    else:
        query = query.filter(BusinessLocation.is_selected.is_(True))
    locations = query.all()
    if not locations:
        locations = (
            db.query(BusinessLocation)
            .filter(BusinessLocation.tenant_id == membership.tenant_id)
            .all()
        )

    context = "\n".join(
        (
            f"- {row.title} | category={row.primary_category or 'n/a'} | "
            f"address={row.address or 'n/a'} | phone={row.phone or 'n/a'} | "
            f"website={row.website or 'n/a'}"
        )
        for row in locations
    ) or "No locations available yet."

    prompt = assistant_prompt(user_message=payload.message, locations_context=context)
    try:
        answer = generate_text(prompt)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"reply": answer, "requires_confirmation": True}
