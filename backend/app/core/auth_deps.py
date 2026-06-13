from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AppUser
from app.services.auth_service import decode_jwt, get_user_by_id


def get_current_user(
    db: Session = Depends(get_db),
    dh_auth: str | None = Cookie(default=None),
) -> AppUser:
    token = dh_auth
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_jwt(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user_id = int(payload["sub"])
    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.approval_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.approval_status}. Contact your Watu administrator.",
        )
    return user


def get_current_user_optional(
    db: Session = Depends(get_db),
    dh_auth: str | None = Cookie(default=None),
) -> AppUser | None:
    if not dh_auth:
        return None
    try:
        return get_current_user(db=db, dh_auth=dh_auth)
    except HTTPException:
        return None


def require_role(*roles: str):
    def _check(user: AppUser = Depends(get_current_user)) -> AppUser:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return _check
