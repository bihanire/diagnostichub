import hashlib
import logging
import random
import smtplib
from datetime import UTC, datetime, timedelta
from email.mime.text import MIMEText

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models.models import AllowedEmail, AppUser, OTPRequest

logger = logging.getLogger(__name__)


def is_email_allowed(email: str, db: Session) -> bool:
    return db.scalar(
        select(AllowedEmail).where(AllowedEmail.email == email.lower().strip())
    ) is not None


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def generate_and_store_otp(email: str, db: Session) -> str:
    code = f"{random.SystemRandom().randint(0, 999999):06d}"
    settings = get_settings()
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.otp_expiry_minutes)

    # Invalidate any unexpired previous OTPs for this email
    old = db.scalars(
        select(OTPRequest)
        .where(OTPRequest.email == email.lower())
        .where(OTPRequest.used.is_(False))
        .where(OTPRequest.expires_at > datetime.now(UTC))
    ).all()
    for o in old:
        o.used = True

    otp = OTPRequest(
        email=email.lower(),
        code_hash=_hash_code(code),
        expires_at=expires_at,
        used=False,
    )
    db.add(otp)
    db.commit()
    return code


def send_otp_email(email: str, code: str, settings: Settings) -> None:
    subject = "Your Watu Simu login code"
    body = (
        f"Your one-time login code is:\n\n"
        f"  {code}\n\n"
        f"It expires in {settings.otp_expiry_minutes} minutes. "
        f"Do not share this code with anyone."
    )

    if not settings.smtp_user or not settings.smtp_password:
        if settings.otp_dev_log:
            logger.info("OTP for %s: %s", email, code)
        return

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = email

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    except Exception:
        logger.exception("Failed to send OTP email to %s", email)
        raise


def verify_otp(email: str, code: str, db: Session) -> bool:
    now = datetime.now(UTC)
    record = db.scalar(
        select(OTPRequest)
        .where(OTPRequest.email == email.lower())
        .where(OTPRequest.used.is_(False))
        .where(OTPRequest.expires_at > now)
        .order_by(OTPRequest.created_at.desc())
    )
    if record is None:
        return False
    if record.code_hash != _hash_code(code):
        return False
    record.used = True
    db.commit()
    return True


def get_or_create_otp_user(email: str, db: Session) -> AppUser:
    user = db.scalar(select(AppUser).where(AppUser.email == email.lower()))
    if user is not None:
        user.last_login_at = datetime.now(UTC)
        db.commit()
        db.refresh(user)
        return user

    sentinel = f"otp:{email.lower()}"
    user = AppUser(
        google_sub=sentinel,
        email=email.lower(),
        full_name="",
        role="ec_agent",
        approval_status="pending",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
