from __future__ import annotations

import logging
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import TYPE_CHECKING

from app.core.config import get_settings

if TYPE_CHECKING:
    from app.models.models import Case

logger = logging.getLogger(__name__)

CASE_TYPE_LABELS = {
    "repair": "Repair",
    "frp": "FRP Unlock",
    "return": "Return",
    "theft": "Theft Report",
}

WARRANTY_LABELS = {
    "IW": "In Warranty",
    "OOW": "Out of Warranty",
    "CID": "Customer-Induced Damage",
}


def _recipient_list() -> list[str]:
    settings = get_settings()
    raw = settings.notify_new_case_emails
    return [e.strip() for e in raw.split(",") if e.strip()]


def send_new_case_notification(case: Case) -> None:
    recipients = _recipient_list()
    if not recipients:
        return

    settings = get_settings()
    if not settings.smtp_user or not settings.smtp_password:
        logger.info(
            "New case notification skipped (SMTP not configured) — case %s for %s",
            case.reference,
            case.client_name,
        )
        return

    from app.services.pdf_service import generate_job_card_pdf

    try:
        pdf_bytes = generate_job_card_pdf(case)
    except Exception:
        logger.exception("Could not generate PDF for case notification %s", case.reference)
        return

    case_type = CASE_TYPE_LABELS.get(case.case_type, case.case_type.upper())
    warranty = WARRANTY_LABELS.get(case.warranty_direction or "", "—")
    location = case.ec_location.name if case.ec_location else "—"
    agent = case.created_by.full_name if case.created_by else "—"

    subject = f"New Job Card: {case.reference} — {case.client_name}"
    body = (
        f"A new job card has been created.\n\n"
        f"Reference:     {case.reference}\n"
        f"Type:          {case_type}\n"
        f"Client:        {case.client_name} ({case.client_phone})\n"
        f"Device:        {case.device_model} | IMEI: {case.device_imei}\n"
        f"Complaint:     {case.complaint}\n"
        f"Warranty:      {warranty}\n"
        f"EC Location:   {location}\n"
        f"Agent:         {agent}\n"
    )

    msg = MIMEMultipart()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(body, "plain"))

    attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
    attachment.add_header(
        "Content-Disposition",
        "attachment",
        filename=f"job-card-{case.reference}.pdf",
    )
    msg.attach(attachment)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.sendmail(settings.smtp_from, recipients, msg.as_string())
        logger.info("Job card notification sent for %s to %s", case.reference, recipients)
    except Exception:
        logger.exception("Failed to send job card notification for %s", case.reference)
