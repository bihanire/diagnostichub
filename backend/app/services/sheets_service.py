from __future__ import annotations

import base64
import json
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.models import Case

logger = logging.getLogger(__name__)

SHEET_HEADERS = [
    "Reference",
    "Case Type",
    "Status",
    "EC Location",
    "Created By",
    "Created At",
    "Client Name",
    "Client Phone",
    "Client Alt Phone",
    "Client ID Number",
    "Device Model",
    "Device IMEI",
    "Complaint",
    "T-Code",
    "SRC Group",
    "Defect Description",
    "Warranty Direction",
    "Warranty Exception",
    "Liquid Exposure",
    "Drop / Prior Repair",
    "SW Update",
    "Normal Use",
    "ASC Name",
    "ASC Code",
    "LS Code",
    "Submitted At",
]


def _case_row(case: Case) -> list[str]:
    def b(val: bool | None) -> str:
        return "Yes" if val is True else ("No" if val is False else "")

    def s(val: object) -> str:
        return str(val) if val is not None else ""

    return [
        case.reference,
        case.case_type,
        case.status,
        case.ec_location.name if case.ec_location else "",
        case.created_by.full_name if case.created_by else "",
        s(case.created_at),
        case.client_name,
        case.client_phone,
        s(case.client_alt_phone),
        s(case.client_id_number),
        case.device_model,
        case.device_imei,
        case.complaint,
        s(case.sym_code),
        s(case.src_group),
        s(case.defect_description),
        s(case.warranty_direction),
        s(case.wty_exception),
        b(case.liquid_exposure),
        b(case.drop_or_repair),
        b(case.sw_update),
        b(case.normal_use),
        s(case.asc_name),
        s(case.asc_code),
        s(case.ls_code),
        s(case.submitted_at),
    ]


def _get_client(credentials_json_b64: str):
    """Return an authorised gspread client from a base64-encoded service account JSON."""
    import gspread
    from google.oauth2.service_account import Credentials

    raw = base64.b64decode(credentials_json_b64).decode("utf-8")
    info = json.loads(raw)
    scopes = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = Credentials.from_service_account_info(info, scopes=scopes)
    return gspread.authorize(creds)


def _ensure_header(worksheet, headers: list[str]) -> None:
    """Write headers on row 1 if the sheet is empty."""
    if worksheet.row_count == 0 or not worksheet.row_values(1):
        worksheet.insert_row(headers, index=1)


def append_case_row(case: Case) -> None:
    """
    Write one row to the configured Google Sheet.
    Silently skips if GOOGLE_SHEETS_CREDENTIALS_JSON or SPREADSHEET_ID are unset.
    """
    from app.core.config import get_settings

    cfg = get_settings()
    if not cfg.google_sheets_credentials_json or not cfg.google_sheets_spreadsheet_id:
        return

    try:
        gc = _get_client(cfg.google_sheets_credentials_json)
        sh = gc.open_by_key(cfg.google_sheets_spreadsheet_id)
        try:
            ws = sh.worksheet(cfg.google_sheets_worksheet_name)
        except Exception:
            ws = sh.add_worksheet(
                title=cfg.google_sheets_worksheet_name, rows=1000, cols=len(SHEET_HEADERS)
            )
        _ensure_header(ws, SHEET_HEADERS)
        ws.append_row(_case_row(case), value_input_option="USER_ENTERED")
    except Exception:
        logger.exception("Sheets sync failed for %s — continuing without sync", case.reference)


def update_case_status_row(case: Case) -> None:
    """
    Find the row matching case.reference and update the Status column (col 2).
    Silently skips if credentials are unset or row not found.
    """
    from app.core.config import get_settings

    cfg = get_settings()
    if not cfg.google_sheets_credentials_json or not cfg.google_sheets_spreadsheet_id:
        return

    try:
        gc = _get_client(cfg.google_sheets_credentials_json)
        sh = gc.open_by_key(cfg.google_sheets_spreadsheet_id)
        ws = sh.worksheet(cfg.google_sheets_worksheet_name)
        cell = ws.find(case.reference, in_column=1)
        if cell:
            status_col = SHEET_HEADERS.index("Status") + 1
            ws.update_cell(cell.row, status_col, case.status)
    except Exception:
        logger.exception(
            "Sheets status update failed for %s — continuing", case.reference
        )
