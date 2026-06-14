from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.models import AppUser, ECLocation
from app.schemas.auth import AppUserResponse, ECLocationItem, ECLocationListResponse


def issue_jwt(user: AppUser) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "loc": user.ec_location_id,
        "exp": datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes),
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_jwt(token: str) -> dict[str, Any] | None:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None


def get_user_by_id(db: Session, user_id: int) -> AppUser | None:
    return db.scalar(select(AppUser).where(AppUser.id == user_id))


def get_ec_locations(db: Session) -> ECLocationListResponse:
    rows = db.scalars(
        select(ECLocation)
        .where(ECLocation.is_active)
        .order_by(ECLocation.country_code, ECLocation.sort_order, ECLocation.id)
    ).all()
    return ECLocationListResponse(
        locations=[ECLocationItem.model_validate(r) for r in rows]
    )


def to_user_response(user: AppUser) -> AppUserResponse:
    loc = None
    if user.ec_location is not None:
        loc = ECLocationItem.model_validate(user.ec_location)
    return AppUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        approval_status=user.approval_status,
        country_code=user.country_code,
        ec_location_id=user.ec_location_id,
        ec_location=loc,
    )
