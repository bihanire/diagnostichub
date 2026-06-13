from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
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
    RegisterRequest,
)
from app.services.auth_service import (
    build_google_auth_url,
    complete_registration,
    decode_reg_token,
    exchange_google_code,
    generate_state,
    get_ec_locations,
    issue_jwt,
    issue_reg_token,
    to_user_response,
    upsert_user_from_google,
)
from app.services.otp_service import (
    generate_and_store_otp,
    get_or_create_otp_user,
    is_email_allowed,
    send_otp_email,
    verify_otp,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/google")
async def google_login(response: Response) -> RedirectResponse:
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured on this server.",
        )
    state = generate_state()
    redirect = RedirectResponse(url=build_google_auth_url(state), status_code=302)
    redirect.set_cookie(
        key="dh_oauth_state",
        value=state,
        max_age=600,
        httponly=True,
        samesite="lax",
        secure=settings.auth_cookie_secure,
    )
    return redirect


@router.get("/callback")
async def google_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    dh_oauth_state: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    settings = get_settings()
    frontend = settings.frontend_url.rstrip("/")

    if error:
        return RedirectResponse(url=f"{frontend}/login?error=oauth_denied", status_code=302)

    if not code or not state:
        return RedirectResponse(url=f"{frontend}/login?error=missing_params", status_code=302)

    if state != dh_oauth_state:
        return RedirectResponse(url=f"{frontend}/login?error=state_mismatch", status_code=302)

    try:
        google_info = await exchange_google_code(code)
    except Exception:
        return RedirectResponse(url=f"{frontend}/login?error=exchange_failed", status_code=302)

    google_sub = google_info.get("sub", "")
    email = google_info.get("email", "")
    full_name = google_info.get("name", email)

    user = upsert_user_from_google(db, google_info)

    response: RedirectResponse

    if user.approval_status == "approved":
        token = issue_jwt(user)
        response = RedirectResponse(url=f"{frontend}/dashboard", status_code=302)
        response.set_cookie(
            key=settings.auth_cookie_name,
            value=token,
            max_age=settings.jwt_expire_minutes * 60,
            httponly=True,
            samesite="lax",
            secure=settings.auth_cookie_secure,
        )
    elif user.approval_status == "pending" and user.ec_location_id is None:
        # New user — needs to complete registration (pick EC location)
        reg_token = issue_reg_token(google_sub, email, full_name)
        response = RedirectResponse(url=f"{frontend}/register", status_code=302)
        response.set_cookie(
            key=settings.auth_reg_cookie_name,
            value=reg_token,
            max_age=settings.auth_reg_cookie_expire_minutes * 60,
            httponly=True,
            samesite="lax",
            secure=settings.auth_cookie_secure,
        )
    else:
        response = RedirectResponse(url=f"{frontend}/pending", status_code=302)

    response.delete_cookie("dh_oauth_state")
    return response


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


@router.post("/register")
def register(
    payload: RegisterRequest,
    response: Response,
    dh_reg: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> AuthStatusResponse:
    settings = get_settings()
    if not dh_reg:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Registration session expired. Sign in again.")
    reg_data = decode_reg_token(dh_reg)
    if reg_data is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Registration token invalid or expired.")

    user = complete_registration(
        db=db,
        google_sub=reg_data["sub"],
        email=reg_data["email"],
        full_name=reg_data["name"],
        ec_location_id=payload.ec_location_id,
        country_code=payload.country_code,
        full_name_override=payload.full_name,
    )
    response.delete_cookie(key=settings.auth_reg_cookie_name, samesite="lax")
    return AuthStatusResponse(authenticated=False, user=to_user_response(user))


@router.get("/locations", response_model=ECLocationListResponse)
def list_locations(db: Session = Depends(get_db)) -> ECLocationListResponse:
    return get_ec_locations(db)


@router.post("/otp/request", response_model=OTPRequestResponse)
def otp_request(payload: OTPRequestBody, db: Session = Depends(get_db)) -> OTPRequestResponse:
    email = payload.email.lower().strip()
    if not email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email is required.")
    if not is_email_allowed(email, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This email is not authorized. Contact your Watu administrator.",
        )
    settings = get_settings()
    code = generate_and_store_otp(email, db)
    try:
        send_otp_email(email, code, settings)
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

    user = get_or_create_otp_user(email, db)

    if user.approval_status == "approved":
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

    if user.approval_status == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Contact your Watu administrator.",
        )

    # pending — needs registration if no name / location yet
    if not user.full_name or user.ec_location_id is None:
        reg_token = issue_reg_token(user.google_sub, user.email, user.full_name or "")
        response.set_cookie(
            key=settings.auth_reg_cookie_name,
            value=reg_token,
            max_age=settings.auth_reg_cookie_expire_minutes * 60,
            httponly=True,
            samesite="lax",
            secure=settings.auth_cookie_secure,
        )
        return OTPVerifyResponse(action="register")

    return OTPVerifyResponse(action="pending")
