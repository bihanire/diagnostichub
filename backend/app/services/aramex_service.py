from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING

import httpx

if TYPE_CHECKING:
    from app.models.models import Case

logger = logging.getLogger(__name__)


def _sign_payload(payload_bytes: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()


def fire_dispatch_webhook(case: Case) -> None:
    """
    POST case dispatch data to ARAMEX_WEBHOOK_URL.
    Signs the payload with ARAMEX_WEBHOOK_SECRET if set.
    Silently skips if ARAMEX_WEBHOOK_URL is unset.
    """
    from app.core.config import get_settings

    cfg = get_settings()
    if not cfg.aramex_webhook_url:
        return

    payload = {
        "event": "case.dispatched",
        "fired_at": datetime.now(UTC).isoformat(),
        "case": {
            "reference": case.reference,
            "case_type": case.case_type,
            "status": case.status,
            "ec_location": case.ec_location.name if case.ec_location else None,
            "ec_country": case.ec_location.country_code if case.ec_location else None,
            "client_name": case.client_name,
            "client_phone": case.client_phone,
            "device_model": case.device_model,
            "device_imei": case.device_imei,
            "asc_name": case.asc_name,
            "asc_code": case.asc_code,
            "ls_code": case.ls_code,
            "complaint": case.complaint,
        },
    }

    try:
        body = json.dumps(payload).encode("utf-8")
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if cfg.aramex_webhook_secret:
            headers["X-Watu-Signature"] = _sign_payload(body, cfg.aramex_webhook_secret)

        resp = httpx.post(cfg.aramex_webhook_url, content=body, headers=headers, timeout=10)
        resp.raise_for_status()
        logger.info("Aramex webhook fired for %s → %s", case.reference, resp.status_code)
    except Exception:
        logger.exception(
            "Aramex webhook failed for %s — dispatch recorded locally, webhook skipped",
            case.reference,
        )
