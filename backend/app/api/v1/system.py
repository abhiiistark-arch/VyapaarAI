from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_membership
from app.db.session import get_db
from app.models.tenant import TenantMembership
from app.services.demo.seed import DEMO_EMAIL, DEMO_PASSWORD, seed_demo_workspace

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/mode")
def mode():
    settings = get_settings()
    return {
        "app": settings.app_name,
        "demo_mode": settings.demo_mode,
        "use_live_google": settings.use_live_google,
        "google_live_enabled": settings.google_live_enabled,
        "gemini_configured": bool(settings.gemini_api_key),
        "switch_instructions": {
            "to_live_google": [
                "Set DEMO_MODE=false",
                "Set USE_LIVE_GOOGLE=true",
                "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
                "Confirm GOOGLE_REDIRECT_URI matches Google Cloud console",
                "Restart backend",
            ]
        },
        "demo_login": {
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD,
        }
        if settings.demo_mode
        else None,
    }


@router.post("/seed-demo")
def seed_demo(
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    if not settings.demo_mode:
        return {"ok": False, "message": "DEMO_MODE is off — seed skipped"}
    # membership unused except to require auth; seed is global demo account
    _ = membership
    return seed_demo_workspace(db)
