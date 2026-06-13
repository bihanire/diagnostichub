import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.models import AppUser, ECLocation
from app.schemas.auth import AppUserResponse, ECLocationItem, ECLocationListResponse

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
_GOOGLE_SCOPES = "openid email profile"


def build_google_auth_url(state: str) -> str:
    settings = get_settings()
    params = {
        "client_id": settings.google_client_id or "",
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": _GOOGLE_SCOPES,
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{_GOOGLE_AUTH_URL}?{query}"


def generate_state() -> str:
    return secrets.token_urlsafe(32)


async def exchange_google_code(code: str) -> dict[str, Any]:
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        response = await client.post(
            _GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        response.raise_for_status()
        token_data = response.json()

    async with httpx.AsyncClient() as client:
        info_response = await client.get(
            _GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        info_response.raise_for_status()
        return info_response.json()


def upsert_user_from_google(db: Session, google_info: dict[str, Any]) -> AppUser:
    google_sub = google_info["sub"]
    email = google_info.get("email", "")
    full_name = google_info.get("name", email)

    user = db.scalar(select(AppUser).where(AppUser.google_sub == google_sub))
    if user is None:
        user = AppUser(
            google_sub=google_sub,
            email=email,
            full_name=full_name,
            role="ec_agent",
            approval_status="pending",
        )
        db.add(user)
        db.flush()
    else:
        user.full_name = full_name
        user.last_login_at = datetime.now(UTC)
    db.commit()
    db.refresh(user)
    return user


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


def issue_reg_token(google_sub: str, email: str, full_name: str) -> str:
    """Short-lived token carried through the /register page for new users."""
    settings = get_settings()
    payload = {
        "sub": google_sub,
        "email": email,
        "name": full_name,
        "purpose": "registration",
        "exp": datetime.now(UTC) + timedelta(minutes=settings.auth_reg_cookie_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_reg_token(token: str) -> dict[str, Any] | None:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("purpose") != "registration":
            return None
        return payload
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


def complete_registration(
    db: Session, google_sub: str, email: str, full_name: str, ec_location_id: int, country_code: str,
    full_name_override: str | None = None,
) -> AppUser:
    existing = db.scalar(select(AppUser).where(AppUser.google_sub == google_sub))
    resolved_name = full_name_override.strip() if full_name_override and full_name_override.strip() else full_name
    if existing is None:
        existing = AppUser(
            google_sub=google_sub,
            email=email,
            full_name=resolved_name,
            role="ec_agent",
            approval_status="pending",
            ec_location_id=ec_location_id,
            country_code=country_code,
        )
        db.add(existing)
    else:
        existing.ec_location_id = ec_location_id
        existing.country_code = country_code
        if resolved_name:
            existing.full_name = resolved_name
    db.commit()
    db.refresh(existing)
    return existing


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
