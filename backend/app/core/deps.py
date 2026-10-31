from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.tenant import TenantMembership
from app.models.user import User

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_membership(
    current_user: User = Depends(get_current_user),
    x_tenant_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> TenantMembership:
    query = db.query(TenantMembership).filter(
        TenantMembership.user_id == current_user.id,
        TenantMembership.status == "active",
    )
    if x_tenant_id:
        query = query.filter(TenantMembership.tenant_id == x_tenant_id)
    membership = query.order_by(TenantMembership.created_at.asc()).first()
    if not membership:
        raise HTTPException(status_code=403, detail="No active workspace")
    return membership
