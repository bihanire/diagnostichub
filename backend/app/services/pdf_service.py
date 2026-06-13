from __future__ import annotations

import io
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from fpdf import FPDF, XPos, YPos

if TYPE_CHECKING:
    from app.models.models import Case

# ── Colours (Watu brand) ──────────────────────────────────────────────────────
WATU_BLUE = (26, 86, 219)       # #1a56db
DARK = (17, 24, 39)             # #111827
MID = (107, 114, 128)           # #6b7280
LIGHT_BG = (244, 245, 247)      # #f4f5f7
WHITE = (255, 255, 255)
BORDER = (229, 231, 235)        # #e5e7eb

CASE_TYPE_LABELS = {
    "repair": "REPAIR",
    "frp": "FRP UNLOCK",
    "return": "RETURN",
    "theft": "THEFT REPORT",
}

WARRANTY_LABELS = {
    "IW": "In Warranty",
    "OOW": "Out of Warranty",
    "CID": "Customer-Induced Damage",
}

LOCK_LABELS = {
    "pin": "PIN",
    "pattern": "Pattern",
    "none": "No Lock",
}


def _fmt_dt(dt: datetime | None) -> str:
    if dt is None:
        return "-"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    # %-d is Linux-only; use %d and strip the leading zero manually
    return dt.strftime("%d %b %Y  %H:%M UTC").lstrip("0") if hasattr(dt, "strftime") else str(dt)


def _bool(val: bool | None) -> str:
    if val is None:
        return "-"
    return "Yes" if val else "No"


class _JobCardPDF(FPDF):
    def __init__(self, case: Case):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.case = case
        self.set_auto_page_break(auto=False)
        self.set_margins(12, 10, 12)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _rgb(self, r: int, g: int, b: int) -> None:
        self.set_draw_color(r, g, b)
        self.set_fill_color(r, g, b)
        self.set_text_color(r, g, b)

    def _section_title(self, text: str, y: float | None = None) -> None:
        if y is not None:
            self.set_y(y)
        self.set_fill_color(*LIGHT_BG)
        self.set_text_color(*MID)
        self.set_font("Helvetica", "B", 7)
        self.cell(0, 5, text.upper(), fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT, border=0)
        self.ln(1)
        self.set_text_color(*DARK)

    def _field(self, label: str, value: str, w: float = 88, last: bool = False) -> None:
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*MID)
        self.cell(w, 4, label, new_x=XPos.RIGHT, new_y=YPos.TOP)
        if last:
            self.ln(0)
        self.set_text_color(*DARK)
        self.set_font("Helvetica", "B", 8)
        x = self.get_x()
        if last:
            self.set_xy(12, self.get_y() + 4)
        else:
            self.set_xy(x - w, self.get_y() + 4)
        self.cell(w, 4.5, value or "-", ln=last)
        if not last:
            self.set_xy(x, self.get_y() - 4.5)

    def _two_fields(
        self,
        l1: str, v1: str,
        l2: str, v2: str,
        w: float = 88,
    ) -> None:
        x0 = self.get_x()
        y0 = self.get_y()
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*MID)
        self.cell(w, 4, l1, new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_text_color(*DARK)
        self.set_font("Helvetica", "B", 8)
        self.set_xy(x0, y0 + 4)
        self.cell(w, 4.5, v1 or "-", new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_xy(x0 + w, y0)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*MID)
        self.cell(w, 4, l2, new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_text_color(*DARK)
        self.set_font("Helvetica", "B", 8)
        self.set_xy(x0 + w, y0 + 4)
        self.cell(w, 4.5, v2 or "-", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(2)

    def _divider(self) -> None:
        self.set_draw_color(*BORDER)
        self.line(12, self.get_y(), 198, self.get_y())
        self.ln(2)

    def _stub(self, label: str, y: float) -> None:
        """Draw one tear-off stub strip."""
        c = self.case
        self.set_draw_color(*BORDER)
        self.set_fill_color(*LIGHT_BG)
        self.rect(12, y, 186, 18, "DF")

        self.set_font("Helvetica", "B", 7)
        self.set_text_color(*WATU_BLUE)
        self.set_xy(14, y + 2)
        self.cell(40, 4, label, new_x=XPos.RIGHT, new_y=YPos.TOP)

        self.set_text_color(*DARK)
        self.set_font("Helvetica", "B", 9)
        self.set_xy(14, y + 7)
        self.cell(80, 5, c.reference, new_x=XPos.RIGHT, new_y=YPos.TOP)

        self.set_font("Helvetica", "", 7)
        self.set_text_color(*MID)
        self.set_xy(100, y + 2)
        self.cell(50, 4, f"{c.client_name}  ·  {c.client_phone}", new_x=XPos.RIGHT, new_y=YPos.TOP)

        self.set_xy(100, y + 7)
        self.cell(50, 4, f"{c.device_model}  ·  {c.device_imei}", new_x=XPos.RIGHT, new_y=YPos.TOP)

        self.set_xy(158, y + 2)
        self.set_font("Helvetica", "B", 7)
        self.set_text_color(*WATU_BLUE)
        label_type = CASE_TYPE_LABELS.get(c.case_type, c.case_type.upper())
        self.cell(38, 4, label_type, align="R", new_x=XPos.RIGHT, new_y=YPos.TOP)

        self.set_xy(158, y + 7)
        self.set_font("Helvetica", "", 6.5)
        self.set_text_color(*MID)
        date_str = _fmt_dt(c.created_at).split("  ")[0]
        self.cell(38, 4, date_str, align="R", new_x=XPos.RIGHT, new_y=YPos.TOP)

    # ── One copy of the card body ─────────────────────────────────────────────

    def _build_copy(self, copy_label: str, y_start: float) -> float:
        """Renders one job card copy starting at y_start. Returns y after body."""
        c = self.case
        self.set_xy(12, y_start)

        # ── Header bar ───────────────────────────────────────────────────────
        self.set_fill_color(*WATU_BLUE)
        self.rect(12, y_start, 186, 14, "F")

        self.set_font("Helvetica", "B", 13)
        self.set_text_color(*WHITE)
        self.set_xy(16, y_start + 2)
        self.cell(100, 10, c.reference, new_x=XPos.RIGHT, new_y=YPos.TOP)

        self.set_font("Helvetica", "B", 8)
        self.set_xy(16, y_start + 8.5)
        label_type = CASE_TYPE_LABELS.get(c.case_type, c.case_type.upper())
        self.cell(100, 4, label_type, new_x=XPos.RIGHT, new_y=YPos.TOP)

        self.set_font("Helvetica", "", 7)
        self.set_xy(130, y_start + 2)
        self.cell(64, 4, f"EC: {c.ec_location.name}", align="R", new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_xy(130, y_start + 6.5)
        self.cell(64, 4, _fmt_dt(c.created_at), align="R", new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_xy(130, y_start + 11)
        self.set_font("Helvetica", "B", 7)
        self.set_text_color(255, 215, 80)
        self.cell(64, 4, copy_label.upper(), align="R", new_x=XPos.RIGHT, new_y=YPos.TOP)

        self.set_text_color(*DARK)
        y = y_start + 17

        # ── Client ───────────────────────────────────────────────────────────
        self.set_y(y)
        self._section_title("Client Information")
        self._two_fields(
            "Full Name", c.client_name,
            "Phone", c.client_phone,
        )
        self._two_fields(
            "Alternate Phone", c.client_alt_phone or "-",
            "ID / Account Number", c.client_id_number or "-",
        )
        y = self.get_y()

        # ── Device ───────────────────────────────────────────────────────────
        self._divider()
        self._section_title("Device")
        self._two_fields(
            "Model", c.device_model,
            "IMEI", c.device_imei,
        )
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*MID)
        self.cell(0, 4, "Complaint / Reported Fault", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*DARK)
        self.set_font("Helvetica", "B", 8)
        self.multi_cell(0, 4.5, c.complaint or "-")
        self.ln(2)

        # ── Diagnostic ───────────────────────────────────────────────────────
        if c.sym_code or c.defect_description:
            self._divider()
            self._section_title("Diagnostic Output")
            self._two_fields(
                "T-Code", c.sym_code or "-",
                "SRC Group", c.src_group or "-",
            )
            if c.defect_description:
                self.set_font("Helvetica", "", 7)
                self.set_text_color(*MID)
                self.cell(0, 4, "Defect Description", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                self.set_text_color(*DARK)
                self.set_font("Helvetica", "B", 8)
                self.multi_cell(0, 4.5, c.defect_description)
                self.ln(2)

        # ── Warranty ─────────────────────────────────────────────────────────
        if c.warranty_direction:
            self._divider()
            self._section_title("Warranty Assessment")
            wty_label = WARRANTY_LABELS.get(c.warranty_direction, c.warranty_direction)
            self._two_fields(
                "Decision", wty_label,
                "Exception Code", c.wty_exception or "-",
            )
            self._two_fields(
                "Liquid Exposure", _bool(c.liquid_exposure),
                "Drop / Prior Repair", _bool(c.drop_or_repair),
            )
            self._two_fields(
                "SW Update Attempted", _bool(c.sw_update),
                "Normal Use Confirmed", _bool(c.normal_use),
            )

        # ── Routing ──────────────────────────────────────────────────────────
        self._divider()
        self._section_title("Dispatch Routing")
        self._two_fields(
            "ASC Name", c.asc_name or "-",
            "ASC Code", c.asc_code or "-",
        )
        self._two_fields(
            "LS Code", c.ls_code or "-",
            "Status", c.status.upper(),
        )
        if c.waybill_number:
            self._two_fields(
                "Aramex Waybill", c.waybill_number,
                "Dispatched", _fmt_dt(c.updated_at),
            )

        # ── Security ─────────────────────────────────────────────────────────
        self._divider()
        self._section_title("Device Security")
        lock_label = LOCK_LABELS.get(c.lock_type or "none", c.lock_type or "None")
        self._two_fields(
            "SIM Tray Present", _bool(c.sim_tray_present),
            "Lock Type", lock_label,
        )
        if c.lock_type == "pin" and c.client_pin:
            self.set_font("Helvetica", "", 7)
            self.set_text_color(*MID)
            self.cell(0, 4, "Client PIN", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_text_color(*DARK)
            self.set_font("Helvetica", "B", 8)
            self.cell(0, 4.5, c.client_pin, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.ln(2)
        if c.lock_type == "pattern" and c.pattern_sequence:
            self.set_font("Helvetica", "", 7)
            self.set_text_color(*MID)
            self.cell(0, 4, "Pattern Sequence", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_text_color(*DARK)
            self.set_font("Helvetica", "B", 8)
            self.cell(0, 4.5, c.pattern_sequence, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.ln(2)

        # ── Signatures ───────────────────────────────────────────────────────
        self._divider()
        self.ln(1)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*MID)
        sig_y = self.get_y()
        self.set_xy(12, sig_y)
        self.cell(88, 4, "EC Agent Signature & Name", new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_xy(100, sig_y)
        self.cell(98, 4, "Client Signature", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(5)
        sig_y2 = self.get_y()
        self.set_draw_color(*BORDER)
        self.line(12, sig_y2, 95, sig_y2)
        self.line(100, sig_y2, 198, sig_y2)
        self.ln(2)

        return self.get_y()

    # ── Entry point ──────────────────────────────────────────────────────────

    def build(self) -> bytes:
        self.add_page()

        # Two copies on a single A4 page — Customer + EC. Watu copy stored on Drive.
        STUB_H = 22
        PAGE_H = 277  # usable height (A4 297 - 10mm top - 10mm bottom)
        BODY_H = (PAGE_H - 2 * STUB_H) / 2  # ~116mm each

        copies = [
            ("Customer Copy", 10),
            ("EC Copy", 10 + BODY_H + STUB_H),
        ]

        for i, (label, y) in enumerate(copies):
            self._build_copy(label, y)
            stub_y = y + BODY_H
            if stub_y < PAGE_H:
                self._stub(label, stub_y)
            if i == 0:
                # Dashed cut line between the two copies
                self.set_draw_color(*MID)
                self.set_dash_pattern(dash=2, gap=2)
                self.line(12, stub_y + STUB_H - 1, 198, stub_y + STUB_H - 1)
                self.set_dash_pattern()

        buf = io.BytesIO()
        self.output(buf)
        return buf.getvalue()


def generate_job_card_pdf(case: Case) -> bytes:
    pdf = _JobCardPDF(case)
    return pdf.build()
