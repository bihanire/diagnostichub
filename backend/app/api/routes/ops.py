from fastapi import APIRouter, Request, Response, status

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.ops import OpsLoginRequest, OpsSessionResponse
from app.services.ops_auth_service import (
    create_ops_session_token,
    get_ops_session_from_request,
    verify_ops_password,
)

router = APIRouter(prefix="/ops", tags=["ops"])
logger = get_logger("relational_encyclopedia.ops")


@router.post("/login", response_model=OpsSessionResponse)
def login_ops(
    payload: OpsLoginRequest,
    request: Request,
    response: Response,
) -> OpsSessionResponse:
    settings = get_settings()
    if not verify_ops_password(payload.password, settings):
        logger.warning(
            "ops_login_failed",
            extra={
                "event": "ops_login_failed",
                "method": request.method,
                "path": request.url.path,
                "status_code": status.HTTP_401_UNAUTHORIZED,
            },
        )
        response.status_code = status.HTTP_401_UNAUTHORIZED
        return OpsSessionResponse(
            authenticated=False,
            message="The password did not match. Please try again.",
        )

    token, expires_at = create_ops_session_token(settings)
    response.set_cookie(
        key=settings.ops_cookie_name,
        value=token,
        httponly=True,
        secure=settings.ops_cookie_secure,
        samesite="lax",
        max_age=max(settings.ops_session_ttl_hours, 1) * 3600,
        path="/",
    )
    logger.debug(
        "ops_login_succeeded",
        extra={
            "event": "ops_login_succeeded",
            "method": request.method,
            "path": request.url.path,
            "status_code": status.HTTP_200_OK,
        },
    )
    return OpsSessionResponse(
        authenticated=True,
        expires_at=expires_at,
        message="Ops access granted.",
    )


@router.post("/logout", response_model=OpsSessionResponse)
def logout_ops(
    request: Request,
    response: Response,
) -> OpsSessionResponse:
    settings = get_settings()
    response.delete_cookie(
        key=settings.ops_cookie_name,
        path="/",
        secure=settings.ops_cookie_secure,
        samesite="lax",
    )
    logger.debug(
        "ops_logout_completed",
        extra={
            "event": "ops_logout_completed",
            "method": request.method,
            "path": request.url.path,
            "status_code": status.HTTP_200_OK,
        },
    )
    return OpsSessionResponse(
        authenticated=False,
        message="Ops session cleared.",
    )


@router.get("/session", response_model=OpsSessionResponse)
def get_ops_session(request: Request) -> OpsSessionResponse:
    settings = get_settings()
    session = get_ops_session_from_request(request, settings=settings)
    if session is None:
        return OpsSessionResponse(authenticated=False)

    return OpsSessionResponse(authenticated=True, expires_at=session.expires_at)
