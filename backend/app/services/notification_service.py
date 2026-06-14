from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.core.config import get_settings
from app.services.email_service import smtp_send

if TYPE_CHECKING:
    from app.models.models import Case

logger = logging.getLogger(__name__)

_CASE_TYPE_LABELS = {
    "repair": "Repair",
    "frp": "FRP Unlock",
    "return": "Return",
    "theft": "Theft Report",
}

_WARRANTY_LABELS = {
    "IW": "In Warranty",
    "OOW": "Out of Warranty",
    "CID": "Customer-Induced Damage",
}


def _recipients() -> list[str]:
    raw = get_settings().notify_new_case_emails
    return [e.strip() for e in raw.split(",") if e.strip()]


def send_new_case_notification(case: Case) -> None:
    to = _recipients()
    if not to:
        return

    settings = get_settings()

    from app.services.pdf_service import generate_job_card_pdf
    try:
        pdf_bytes = generate_job_card_pdf(case)
    except Exception:
        logger.exception("Could not generate PDF for case %s", case.reference)
        return

    case_type = _CASE_TYPE_LABELS.get(case.case_type, case.case_type.upper())
    warranty = _WARRANTY_LABELS.get(case.warranty_direction or "", "—")
    location = case.ec_location.name if case.ec_location else "—"
    agent = case.created_by.full_name if case.created_by else "—"

    plain = (
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

    smtp_send(
        recipients=to,
        subject=f"New Job Card: {case.reference} — {case.client_name}",
        html=f"<pre>{plain}</pre>",
        plain=plain,
        settings=settings,
        attachments=[(pdf_bytes, f"job-card-{case.reference}.pdf")],
    )
