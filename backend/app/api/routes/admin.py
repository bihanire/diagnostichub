from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth_deps import require_role
from app.core.database import get_db
from app.models.models import AllowedEmail, AppUser
from app.schemas.admin import (
    AdminActionResponse,
    AdminUserListResponse,
    AllowedEmailAddRequest,
    AllowedEmailAddResponse,
    AllowedEmailItem,
    AllowedEmailListResponse,
)
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


@router.get("/allowed-emails", response_model=AllowedEmailListResponse)
def list_allowed_emails(
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(_admin_only),
) -> AllowedEmailListResponse:
    rows = db.scalars(select(AllowedEmail).order_by(AllowedEmail.created_at.desc())).all()
    return AllowedEmailListResponse(
        emails=[AllowedEmailItem.model_validate(r) for r in rows],
        total=len(rows),
    )


@router.post("/allowed-emails", response_model=AllowedEmailAddResponse, status_code=201)
def add_allowed_email(
    payload: AllowedEmailAddRequest,
    db: Session = Depends(get_db),
    admin: AppUser = Depends(_admin_only),
) -> AllowedEmailAddResponse:
    email = payload.email.lower().strip()
    if not email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email is required.")
    existing = db.scalar(select(AllowedEmail).where(AllowedEmail.email == email))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in allowlist.")
    entry = AllowedEmail(email=email, notes=payload.notes, added_by_id=admin.id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return AllowedEmailAddResponse(message=f"{email} added to allowlist.", item=AllowedEmailItem.model_validate(entry))


@router.delete("/allowed-emails/{entry_id}")
def remove_allowed_email(
    entry_id: int,
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(_admin_only),
) -> dict[str, str]:
    entry = db.get(AllowedEmail, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found.")
    email = entry.email
    db.delete(entry)
    db.commit()
    return {"message": f"{email} removed from allowlist."}
