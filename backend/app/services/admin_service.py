from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import AppUser
from app.schemas.admin import AdminUserItem, AdminUserListResponse


def _to_item(user: AppUser) -> AdminUserItem:
    return AdminUserItem(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        approval_status=user.approval_status,
        country_code=user.country_code,
        ec_location_id=user.ec_location_id,
        ec_location_name=user.ec_location.name if user.ec_location else None,
        created_at=user.created_at,
        approved_at=user.approved_at,
        last_login_at=user.last_login_at,
    )


def list_all_users(db: Session) -> AdminUserListResponse:
    users = list(
        db.scalars(
            select(AppUser).order_by(
                # pending first, then alphabetical
                AppUser.approval_status.desc(),
                AppUser.created_at.desc(),
            )
        ).all()
    )
    pending_count = sum(1 for u in users if u.approval_status == "pending")
    return AdminUserListResponse(
        users=[_to_item(u) for u in users],
        total=len(users),
        pending_count=pending_count,
    )


def approve_user(db: Session, user_id: int, admin: AppUser) -> AppUser:
    user = db.scalar(select(AppUser).where(AppUser.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if user.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own status.")
    user.approval_status = "approved"
    user.approved_by_id = admin.id
    user.approved_at = datetime.now(UTC)
    db.commit()
    db.refresh(user)
    return user


def suspend_user(db: Session, user_id: int, admin: AppUser) -> AppUser:
    user = db.scalar(select(AppUser).where(AppUser.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if user.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own status.")
    user.approval_status = "suspended"
    db.commit()
    db.refresh(user)
    return user
