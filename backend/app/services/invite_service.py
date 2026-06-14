from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import AppUser, InviteToken


def create_invite(
    db: Session,
    ec_location_id: int,
    country_code: str,
    role: str,
    label: str | None,
    expires_in_days: int,
    max_uses: int | None,
    auto_approve: bool,
    created_by_id: int,
) -> InviteToken:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(days=expires_in_days)
    invite = InviteToken(
        token=token,
        label=label,
        ec_location_id=ec_location_id,
        country_code=country_code,
        role=role,
        created_by_id=created_by_id,
        expires_at=expires_at,
        max_uses=max_uses,
        auto_approve=auto_approve,
        use_count=0,
        is_active=True,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


def get_invite_by_token(db: Session, token: str) -> InviteToken | None:
    return db.scalar(select(InviteToken).where(InviteToken.token == token))


def is_invite_valid(invite: InviteToken) -> bool:
    if not invite.is_active:
        return False
    if invite.expires_at.replace(tzinfo=None) < datetime.utcnow():
        return False
    if invite.max_uses is not None and invite.use_count >= invite.max_uses:
        return False
    return True


def consume_invite(db: Session, invite: InviteToken) -> None:
    invite.use_count += 1
    if invite.max_uses is not None and invite.use_count >= invite.max_uses:
        invite.is_active = False
    db.commit()


def revoke_invite(db: Session, invite_id: int) -> InviteToken | None:
    invite = db.get(InviteToken, invite_id)
    if invite is None:
        return None
    invite.is_active = False
    db.commit()
    return invite


def list_invites(db: Session) -> list[InviteToken]:
    return list(db.scalars(select(InviteToken).order_by(InviteToken.created_at.desc())).all())


def register_via_invite(
    db: Session,
    invite: InviteToken,
    email: str,
    full_name: str,
) -> AppUser:
    email = email.lower().strip()
    sentinel = f"otp:{email}"
    existing = db.scalar(select(AppUser).where(AppUser.email == email))

    if existing is not None:
        if not existing.full_name and full_name:
            existing.full_name = full_name
        existing.ec_location_id = invite.ec_location_id
        existing.country_code = invite.country_code
        existing.role = invite.role
        if invite.auto_approve and existing.approval_status == "pending":
            existing.approval_status = "approved"
        existing.last_login_at = datetime.now(UTC)
        db.commit()
        db.refresh(existing)
        return existing

    approval = "approved" if invite.auto_approve else "pending"
    user = AppUser(
        google_sub=sentinel,
        email=email,
        full_name=full_name,
        role=invite.role,
        approval_status=approval,
        ec_location_id=invite.ec_location_id,
        country_code=invite.country_code,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
