from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth_deps import require_role
from app.core.config import get_settings
from app.core.database import get_db
from app.models.models import AppUser
from app.schemas.admin import (
    ActivityResponse,
    AdminActionResponse,
    AdminCreateUserRequest,
    AdminCreateUserResponse,
    AdminUserListResponse,
    InviteCreateRequest,
    InviteCreateResponse,
    InviteItem,
    InviteListResponse,
)
from app.services.activity_service import get_activity
from app.services.admin_service import (
    _to_item,
    approve_user,
    create_user_direct,
    list_all_users,
    suspend_user,
)
from app.services.invite_service import (
    create_invite,
    list_invites,
    revoke_invite,
)

router = APIRouter(prefix="/admin", tags=["admin"])

_admin_only = require_role("watu_admin")


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=AdminUserListResponse)
def get_users(
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(_admin_only),
) -> AdminUserListResponse:
    return list_all_users(db)


@router.post("/users", response_model=AdminCreateUserResponse, status_code=201)
def create_user(
    payload: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    admin: AppUser = Depends(_admin_only),
) -> AdminCreateUserResponse:
    user = create_user_direct(db, payload, admin)
    return AdminCreateUserResponse(
        message=f"{user.full_name} ({user.email}) created and approved.",
        user=_to_item(user),
    )


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


# ── Invite links ──────────────────────────────────────────────────────────────

@router.get("/invites", response_model=InviteListResponse)
def get_invites(
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(_admin_only),
) -> InviteListResponse:
    return InviteListResponse(invites=[InviteItem.model_validate(i) for i in list_invites(db)])


@router.post("/invites", response_model=InviteCreateResponse, status_code=201)
def create_invite_link(
    payload: InviteCreateRequest,
    db: Session = Depends(get_db),
    admin: AppUser = Depends(_admin_only),
) -> InviteCreateResponse:
    invite = create_invite(
        db=db,
        ec_location_id=payload.ec_location_id,
        country_code=payload.country_code,
        role=payload.role,
        label=payload.label,
        expires_in_days=payload.expires_in_days,
        max_uses=payload.max_uses,
        auto_approve=payload.auto_approve,
        created_by_id=admin.id,
    )
    settings = get_settings()
    frontend = settings.frontend_url.rstrip("/")
    link = f"{frontend}/join/{invite.token}"
    return InviteCreateResponse(
        message=f"Invite link created: {link}",
        invite=InviteItem.model_validate(invite),
    )


@router.delete("/invites/{invite_id}")
def revoke_invite_link(
    invite_id: int,
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(_admin_only),
) -> dict[str, str]:
    invite = revoke_invite(db, invite_id)
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found.")
    return {"message": "Invite revoked."}


# ── Activity dashboard ────────────────────────────────────────────────────────

@router.get("/activity", response_model=ActivityResponse)
def get_activity_dashboard(
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(_admin_only),
) -> ActivityResponse:
    return get_activity(db)
