import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_membership, get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.business import BusinessLocation
from app.models.google import GoogleConnection
from app.models.tenant import Subscription, Tenant, TenantMembership
from app.models.user import User
from app.schemas.auth import LoginRequest, MeResponse, RegisterRequest, TenantOut, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "workspace"


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        platform_role="user",
    )
    db.add(user)
    db.flush()

    slug = _slugify(payload.business_name)
    existing = db.query(Tenant).filter(Tenant.slug == slug).first()
    if existing:
        slug = f"{slug}-{user.id[:8]}"

    role = payload.role if payload.role in {"owner", "agency_manager", "team_member"} else "owner"
    tenant = Tenant(name=payload.business_name, slug=slug, plan="starter")
    db.add(tenant)
    db.flush()
    db.add(TenantMembership(user_id=user.id, tenant_id=tenant.id, role=role))
    db.add(Subscription(tenant_id=tenant.id, plan="starter", status="trial"))
    db.commit()
    return TokenResponse(access_token=create_access_token(user.id, {"tenant_id": tenant.id}))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    membership = (
        db.query(TenantMembership)
        .filter(TenantMembership.user_id == user.id, TenantMembership.status == "active")
        .first()
    )
    extra = {"tenant_id": membership.tenant_id} if membership else {}
    return TokenResponse(access_token=create_access_token(user.id, extra))


@router.get("/me", response_model=MeResponse)
def me(
    current_user: User = Depends(get_current_user),
    membership: TenantMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant = db.get(Tenant, membership.tenant_id)
    connected = (
        db.query(GoogleConnection)
        .filter(
            GoogleConnection.tenant_id == membership.tenant_id,
            GoogleConnection.status == "connected",
        )
        .first()
        is not None
    )
    selected = (
        db.query(BusinessLocation)
        .filter(BusinessLocation.tenant_id == membership.tenant_id, BusinessLocation.is_selected.is_(True))
        .count()
    )
    return MeResponse(
        user=UserOut(
            id=current_user.id,
            email=current_user.email,
            full_name=current_user.full_name,
            platform_role=current_user.platform_role,
            brand_tone=current_user.brand_tone,
        ),
        tenant=TenantOut(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            plan=tenant.plan,
            status=tenant.status,
            role=membership.role,
        )
        if tenant
        else None,
        google_connected=connected,
        selected_location_count=selected,
    )
