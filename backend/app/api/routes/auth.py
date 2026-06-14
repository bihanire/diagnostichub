from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.auth_deps import get_current_user_optional
from app.core.config import get_settings
from app.core.database import get_db
from app.models.models import AppUser
from app.schemas.auth import (
    AuthStatusResponse,
    ECLocationListResponse,
    LogoutResponse,
    OTPRequestBody,
    OTPRequestResponse,
    OTPVerifyBody,
    OTPVerifyResponse,
)
from app.services.auth_service import (
    get_ec_locations,
    issue_jwt,
    to_user_response,
)
from app.schemas.admin import InviteInfoResponse, InviteOTPVerifyRequest, InviteOTPVerifyResponse
from app.services.invite_service import (
    consume_invite,
    get_invite_by_token,
    is_invite_valid,
    register_via_invite,
)
from app.services.email_service import send_account_ready_email
from app.services.otp_service import (
    generate_and_store_otp,
    get_registered_user,
    send_otp_email,
    stamp_last_login,
    verify_otp,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=AuthStatusResponse)
def get_me(
    user: AppUser | None = Depends(get_current_user_optional),
) -> AuthStatusResponse:
    if user is None:
        return AuthStatusResponse(authenticated=False)
    return AuthStatusResponse(authenticated=True, user=to_user_response(user))


@router.post("/logout", response_model=LogoutResponse)
def logout(response: Response) -> LogoutResponse:
    settings = get_settings()
    response.delete_cookie(key=settings.auth_cookie_name, samesite="lax")
    response.delete_cookie(key=settings.auth_reg_cookie_name, samesite="lax")
    return LogoutResponse(message="Logged out")


@router.get("/locations", response_model=ECLocationListResponse)
def list_locations(db: Session = Depends(get_db)) -> ECLocationListResponse:
    return get_ec_locations(db)


@router.post("/otp/request", response_model=OTPRequestResponse)
def otp_request(payload: OTPRequestBody, db: Session = Depends(get_db)) -> OTPRequestResponse:
    email = payload.email.lower().strip()
    if not email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email is required.")
    user = get_registered_user(email, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This email is not registered. Contact your Watu administrator.",
        )
    settings = get_settings()
    code = generate_and_store_otp(email, db)
    try:
        send_otp_email(email, code, settings, full_name=user.full_name)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send email. Please try again or contact your administrator.",
        )
    return OTPRequestResponse(message="Code sent. Check your email.")


@router.post("/otp/verify", response_model=OTPVerifyResponse)
def otp_verify(
    payload: OTPVerifyBody,
    response: Response,
    db: Session = Depends(get_db),
) -> OTPVerifyResponse:
    settings = get_settings()
    email = payload.email.lower().strip()
    if not verify_otp(email, payload.code.strip(), db):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired code. Request a new one.",
        )
    user = get_registered_user(email, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not active. Contact your Watu administrator.",
        )
    stamp_last_login(user, db)
    token = issue_jwt(user)
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=settings.jwt_expire_minutes * 60,
        httponly=True,
        samesite="lax",
        secure=settings.auth_cookie_secure,
    )
    return OTPVerifyResponse(action="dashboard")


# ── Invite-link OTP flow ──────────────────────────────────────────────────────

@router.get("/invite/{token}", response_model=InviteInfoResponse)
def get_invite_info(token: str, db: Session = Depends(get_db)) -> InviteInfoResponse:
    invite = get_invite_by_token(db, token)
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite link not found.")
    valid = is_invite_valid(invite)
    return InviteInfoResponse(
        ec_name=invite.ec_location.name,
        ec_id=invite.ec_location_id,
        country_code=invite.country_code,
        role=invite.role,
        label=invite.label,
        expires_at=invite.expires_at,
        auto_approve=invite.auto_approve,
        valid=valid,
    )


@router.post("/invite/{token}/request", response_model=OTPRequestResponse)
def invite_otp_request(
    token: str,
    payload: OTPRequestBody,
    db: Session = Depends(get_db),
) -> OTPRequestResponse:
    invite = get_invite_by_token(db, token)
    if invite is None or not is_invite_valid(invite):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invite link is invalid or has expired.",
        )
    email = payload.email.lower().strip()
    if not email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email is required.")
    settings = get_settings()
    code = generate_and_store_otp(email, db)
    try:
        send_otp_email(email, code, settings)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send email. Please try again.",
        )
    return OTPRequestResponse(message="Code sent. Check your email.")


@router.post("/invite/{token}/verify", response_model=InviteOTPVerifyResponse)
def invite_otp_verify(
    token: str,
    payload: InviteOTPVerifyRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> InviteOTPVerifyResponse:
    settings = get_settings()
    invite = get_invite_by_token(db, token)
    if invite is None or not is_invite_valid(invite):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invite link is invalid or has expired.",
        )
    email = payload.email.lower().strip()
    full_name = payload.full_name.strip()
    if not full_name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Full name is required.")
    if not verify_otp(email, payload.code.strip(), db):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired code. Request a new one.",
        )

    user = register_via_invite(db, invite, email, full_name)
    consume_invite(db, invite)

    if user.approval_status == "approved":
        jwt_token = issue_jwt(user)
        response.set_cookie(
            key=settings.auth_cookie_name,
            value=jwt_token,
            max_age=settings.jwt_expire_minutes * 60,
            httponly=True,
            samesite="lax",
            secure=settings.auth_cookie_secure,
        )
        send_account_ready_email(user, settings)
        return InviteOTPVerifyResponse(action="dashboard", auto_approved=True)

    return InviteOTPVerifyResponse(action="pending")
