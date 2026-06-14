import hashlib
import logging
import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models.models import AppUser, OTPRequest
from app.services.email_service import smtp_send

logger = logging.getLogger(__name__)


def get_registered_user(email: str, db: Session) -> AppUser | None:
    """Return the user only if they are registered and approved."""
    return db.scalar(
        select(AppUser)
        .where(AppUser.email == email.lower().strip())
        .where(AppUser.approval_status == "approved")
    )


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


def _otp_html(full_name: str | None, code: str, expiry_minutes: int) -> str:
    greeting = f"Hi <strong>{full_name}</strong>," if full_name else "Hi,"
    return f"""<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;padding:40px 36px;max-width:480px;">
        <tr><td>
          <p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1a56db;">
            Watu Simu Support
          </p>
          <p style="margin:0 0 8px;font-size:15px;color:#111827;">
            {greeting}
          </p>
          <p style="margin:0 0 20px;font-size:15px;color:#111827;">
            Thank you for your attempt to login to the <strong>Technical Support Portal</strong>.
          </p>
          <p style="margin:0 0 10px;font-size:13px;color:#6b7280;">
            Your One-Time Password:
          </p>
          <div style="border:1.5px dashed #d1d5db;border-radius:6px;padding:24px;
                      text-align:center;margin:0 0 20px;">
            <span style="font-size:40px;font-weight:900;letter-spacing:10px;color:#111827;">
              {code}
            </span>
          </div>
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            This code expires in <strong>{expiry_minutes} minutes</strong>.
            Do not share it with anyone.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def send_otp_email(
    email: str,
    code: str,
    settings: Settings,
    full_name: str | None = None,
) -> None:
    if not settings.smtp_user or not settings.smtp_password:
        if settings.otp_dev_log:
            logger.info("OTP for %s: %s", email, code)
        return

    plain = (
        f"Your one-time login code is: {code}\n\n"
        f"It expires in {settings.otp_expiry_minutes} minutes. "
        f"Do not share this code with anyone."
    )
    smtp_send(
        recipients=[email],
        subject="Verification Code for Support Portal",
        html=_otp_html(full_name, code, settings.otp_expiry_minutes),
        plain=plain,
        settings=settings,
        raise_on_failure=True,
    )


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


def stamp_last_login(user: AppUser, db: Session) -> None:
    user.last_login_at = datetime.now(UTC)
    db.commit()
