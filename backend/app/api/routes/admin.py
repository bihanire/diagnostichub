from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth_deps import require_role
from app.core.database import get_db
from app.models.models import AppUser
from app.schemas.admin import AdminActionResponse, AdminUserListResponse
from app.services.admin_service import (
    _to_item,
    approve_user,
    list_all_users,
    suspend_user,
)

router = APIRouter(prefix="/admin", tags=["admin"])

_admin_only = require_role("watu_admin")


@router.get("/users", response_model=AdminUserListResponse)
def get_users(
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(_admin_only),
) -> AdminUserListResponse:
    return list_all_users(db)


@router.post("/users/{user_id}/approve", response_model=AdminActionResponse)
def approve(
    user_id: int,
    db: Session = Depends(get_db),
    admin: AppUser = Depends(_admin_only),
) -> AdminActionResponse:
    user = approve_user(db, user_id, admin)
    return AdminActionResponse(message=f"{user.full_name} approved.", user=_to_item(user))


@router.post("/users/{user_id}/suspend", response_model=AdminActionResponse)
def suspend(
    user_id: int,
    db: Session = Depends(get_db),
    admin: AppUser = Depends(_admin_only),
) -> AdminActionResponse:
    user = suspend_user(db, user_id, admin)
    return AdminActionResponse(message=f"{user.full_name} suspended.", user=_to_item(user))
