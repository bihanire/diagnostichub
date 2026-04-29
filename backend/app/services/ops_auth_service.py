import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger("relational_encyclopedia.ops_auth")


@dataclass(frozen=True)
class OpsSession:
    expires_at: datetime


def validate_ops_auth_settings(settings: Settings) -> None:
    if not settings.ops_auth_enabled:
        return

    missing_fields: list[str] = []
    if not settings.ops_shared_password:
        missing_fields.append("OPS_SHARED_PASSWORD")
    if not settings.ops_session_secret:
        missing_fields.append("OPS_SESSION_SECRET")

    if missing_fields:
        joined = ", ".join(missing_fields)
        raise RuntimeError(f"Ops auth is enabled, but required settings are missing: {joined}")


def create_ops_session_token(
    settings: Settings,
    *,
    issued_at: datetime | None = None,
    ttl_seconds: int | None = None,
) -> tuple[str, datetime]:
    now = issued_at or datetime.now(timezone.utc)
    lifetime_seconds = ttl_seconds or max(settings.ops_session_ttl_hours, 1) * 3600
    expires_at = now + timedelta(seconds=lifetime_seconds)
    payload = {
        "sub": "ops",
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    payload_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    signature = hmac.new(
        _get_secret_bytes(settings),
        payload_bytes,
        hashlib.sha256,
    ).digest()
    token = f"{_urlsafe_encode(payload_bytes)}.{_urlsafe_encode(signature)}"
    return token, expires_at


def read_ops_session_token(
    token: str | None,
    *,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> OpsSession | None:
    if not token:
        return None

    resolved_settings = settings or get_settings()

    try:
        payload_segment, signature_segment = token.split(".", maxsplit=1)
        payload_bytes = _urlsafe_decode(payload_segment)
        expected_signature = hmac.new(
            _get_secret_bytes(resolved_settings),
            payload_bytes,
            hashlib.sha256,
        ).digest()
        provided_signature = _urlsafe_decode(signature_segment)
    except Exception:
        return None

    if not hmac.compare_digest(expected_signature, provided_signature):
        return None

    try:
        payload = json.loads(payload_bytes.decode("utf-8"))
        if payload.get("sub") != "ops":
            return None
        expires_at = datetime.fromtimestamp(int(payload["exp"]), tz=timezone.utc)
    except Exception:
        return None

    if expires_at <= (now or datetime.now(timezone.utc)):
        return None

    return OpsSession(expires_at=expires_at)


def get_ops_session_from_request(
    request: Request,
    *,
    settings: Settings | None = None,
) -> OpsSession | None:
    resolved_settings = settings or get_settings()
    token = request.cookies.get(resolved_settings.ops_cookie_name)
    return read_ops_session_token(token, settings=resolved_settings)


def require_ops_session(request: Request) -> OpsSession:
    settings = get_settings()
    session = get_ops_session_from_request(request, settings=settings)
    if session is None:
        logger.warning(
            "ops_session_rejected",
            extra={
                "event": "ops_session_rejected",
                "method": request.method,
                "path": request.url.path,
                "status_code": status.HTTP_401_UNAUTHORIZED,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ops access is required for this view.",
        )

    logger.debug(
        "ops_session_valid",
        extra={
            "event": "ops_session_valid",
            "method": request.method,
            "path": request.url.path,
            "status_code": status.HTTP_200_OK,
        },
    )
    return session


def verify_ops_password(password: str, settings: Settings) -> bool:
    expected_password = settings.ops_shared_password or ""
    return hmac.compare_digest(password, expected_password)


def _get_secret_bytes(settings: Settings) -> bytes:
    secret = settings.ops_session_secret
    if not secret:
        raise RuntimeError("OPS_SESSION_SECRET is not configured.")
    return secret.encode("utf-8")


def _urlsafe_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _urlsafe_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")
