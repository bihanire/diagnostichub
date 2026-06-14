from __future__ import annotations

import logging
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import TYPE_CHECKING

from app.core.config import Settings

if TYPE_CHECKING:
    from app.models.models import AppUser, Case

logger = logging.getLogger(__name__)

_BLUE = "#1a56db"
_DARK = "#111827"
_MID = "#6b7280"
_LIGHT = "#f4f5f7"


def _shell(content_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:{_LIGHT};font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;padding:40px 36px;max-width:480px;">
        <tr><td>
          <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:{_BLUE};">
            Watu Simu Support
          </p>
          {content_html}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def smtp_send(
    *,
    recipients: list[str],
    subject: str,
    html: str,
    plain: str,
    settings: Settings,
    attachments: list[tuple[bytes, str]] | None = None,
    raise_on_failure: bool = False,
) -> None:
    if not settings.smtp_user or not settings.smtp_password:
        logger.info("SMTP not configured — skipping: %s → %s", subject, recipients)
        return

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = ", ".join(recipients)

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(plain, "plain"))
    alt.attach(MIMEText(html, "html"))
    msg.attach(alt)

    if attachments:
        for data, filename in attachments:
            part = MIMEApplication(data, _subtype="pdf")
            part.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(part)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as s:
            s.starttls()
            s.login(settings.smtp_user, settings.smtp_password)
            s.sendmail(settings.smtp_from, recipients, msg.as_string())
        logger.info("Email sent to %s: %s", recipients, subject)
    except Exception:
        logger.exception("Failed to send email to %s: %s", recipients, subject)
        if raise_on_failure:
            raise


def send_account_ready_email(user: "AppUser", settings: Settings) -> None:
    login_url = f"{settings.frontend_url.rstrip('/')}/login"
    content = f"""
      <p style="margin:0 0 8px;font-size:15px;color:{_DARK};">
        Hi <strong>{user.full_name}</strong>,
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:{_DARK};">
        Your account on the <strong>Watu Simu Technical Support Portal</strong> is ready.
        You can now log in and start using the platform.
      </p>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="{login_url}"
           style="display:inline-block;background:{_BLUE};color:#ffffff;font-size:15px;
                  font-weight:700;text-decoration:none;border-radius:6px;padding:12px 28px;">
          Log in now →
        </a>
      </div>
      <p style="margin:0;font-size:13px;color:{_MID};">
        Sign in with your work email: <strong>{user.email}</strong>.<br>
        You will receive a one-time code each time you log in — no password needed.
      </p>
    """
    smtp_send(
        recipients=[user.email],
        subject="Your Watu Simu Support Portal account is ready",
        html=_shell(content),
        plain=(
            f"Hi {user.full_name},\n\n"
            f"Your Watu Simu Support Portal account is ready.\n\n"
            f"Log in at: {login_url}\n"
            f"Use your work email: {user.email}\n\n"
            f"You will receive a one-time code each time you sign in — no password needed."
        ),
        settings=settings,
    )


_STATUS_LABELS = {
    "dispatched": "Dispatched for repair",
    "closed": "Closed",
    "cancelled": "Cancelled",
}

_STATUS_COLORS = {
    "dispatched": _BLUE,
    "closed": "#057a55",
    "cancelled": "#e02424",
}


def send_case_status_email(
    case: "Case",
    new_status: str,
    agent_email: str,
    agent_name: str,
    settings: Settings,
) -> None:
    label = _STATUS_LABELS.get(new_status, new_status.title())
    color = _STATUS_COLORS.get(new_status, _BLUE)
    case_url = f"{settings.frontend_url.rstrip('/')}/cases/{case.reference}"

    waybill_row = ""
    if new_status == "dispatched" and case.waybill_number:
        waybill_row = (
            f'<p style="margin:0 0 16px;font-size:14px;color:{_DARK};">'
            f"Aramex waybill: <strong>{case.waybill_number}</strong></p>"
        )

    content = f"""
      <p style="margin:0 0 8px;font-size:15px;color:{_DARK};">
        Hi <strong>{agent_name}</strong>,
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:{_DARK};">
        Job card <strong>{case.reference}</strong> for
        <strong>{case.client_name}</strong> ({case.device_model}) has been updated.
      </p>
      <div style="border-left:4px solid {color};padding:12px 16px;
                  margin:0 0 20px;background:#f9fafb;">
        <p style="margin:0;font-size:14px;color:{_DARK};">
          Status: <strong style="color:{color};">{label}</strong>
        </p>
      </div>
      {waybill_row}
      <div style="text-align:center;margin:0 0 24px;">
        <a href="{case_url}"
           style="display:inline-block;background:{_BLUE};color:#ffffff;font-size:14px;
                  font-weight:700;text-decoration:none;border-radius:6px;padding:10px 24px;">
          View job card →
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:{_MID};">
        This is an automated notification from the Watu Simu Technical Support Portal.
      </p>
    """
    plain = (
        f"Hi {agent_name},\n\n"
        f"Job card {case.reference} for {case.client_name} ({case.device_model}) "
        f"has been updated to: {label}.\n"
    )
    if new_status == "dispatched" and case.waybill_number:
        plain += f"Aramex waybill: {case.waybill_number}\n"
    plain += f"\nView case: {case_url}"

    smtp_send(
        recipients=[agent_email],
        subject=f"Job card {case.reference} — {label}",
        html=_shell(content),
        plain=plain,
        settings=settings,
    )
