from __future__ import annotations

import io
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from fpdf import FPDF, XPos, YPos

if TYPE_CHECKING:
    from app.models.models import Case

# ── Colours ──────────────────────────────────────────────────────────────────
BLACK  = (0,   0,   0)
WATU_BLUE = (26, 86, 219)
MID    = (107, 114, 128)
WHITE  = (255, 255, 255)
ORANGE = (234, 88,  12)

# ── Terms & Conditions ────────────────────────────────────────────────────────
TERMS = [
    "In-warranty repair will be carried out subject to warranty validation by the Samsung service center staff.",
    "Out-warranty repairs will require the customers pre-approval prior to repairs commencing. Out-warranty are "
    "any damages caused by mishandling and are not limited to: dropping, scratching, liquid damage, exposure to moisture.",
    "The product has been accepted for service subject to Samsung internal review.",
    "When handing over your device for repair, please remove your sim card, charger and all accessories. Watu and "
    "its service partners will not be held responsible for sim card, charger or any other accessories unless duly "
    "signed in at the time of handling the product for repair.",
    "Watu and its service partners will not be held responsible for the loss of any data on any phone handed in for "
    "repair. It is your responsibility to ensure that data has been backed up safely.",
    "Watu does not carry out any repairs and only serves as a collection point for Accredited Authorized Samsung service centers.",
    "You're required to follow up with your device after a quote is issued & collect your device after repairs are "
    "completed within a maximum period of 30 days. Failure to which the device shall be considered as surrendered.",
    "Rejecting a quotation for self-repairs will require a reduction in some or all of your arrears based on loan "
    "maturity and for write-off Legal Status before the device is issued back to you.",
    "Upon signature of this document and/or any document to which this document is attached shall signify your "
    "acceptance of the terms hereof.",
]

WARRANTY_LABELS = {
    "IW": "In warranty",
    "OOW": "Out of warranty",
    "CID": "Customer-Induced Damage",
}


def _date_str(dt: datetime | None) -> str:
    if dt is None:
        return "-"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.strftime("%Y-%m-%d")


def _bool_str(val: bool | None) -> str:
    if val is None:
        return "-"
    return "Yes" if val else "No"


# ── PDF class ─────────────────────────────────────────────────────────────────

class WatuJobCardPDF(FPDF):
    LM = 12        # left margin
    RM = 12        # right margin
    PW = 186       # usable page width (210 - 24)
    HALF = 93      # half of PW

    def __init__(self, case: "Case") -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.c = case
        self.set_auto_page_break(auto=False)
        self.set_margins(self.LM, 10, self.RM)

    # ── colour shortcuts ─────────────────────────────────────────────────────

    def _tc(self, r: int, g: int, b: int) -> None:
        self.set_text_color(r, g, b)

    def _dc(self, r: int, g: int, b: int) -> None:
        self.set_draw_color(r, g, b)

    def _fc(self, r: int, g: int, b: int) -> None:
        self.set_fill_color(r, g, b)

    def _lw(self, w: float) -> None:
        self.set_line_width(w)

    # ── table cell helpers ───────────────────────────────────────────────────

    def _cell_inner(self, x: float, y: float, w: float, label: str, value: str) -> None:
        """Render label (bold) + value (regular) inside a cell, without border."""
        self.set_xy(x + 2, y + 1.5)
        self.set_font("Helvetica", "B", 7.5)
        self._tc(*BLACK)
        self.cell(w - 3, 4, label)

        self.set_xy(x + 2, y + 6)
        self.set_font("Helvetica", "", 8.5)
        self.cell(w - 3, 4.5, value or "-")

    def _cell_inner_wrap(self, x: float, y: float, w: float, label: str, value: str) -> None:
        """Like _cell_inner but value may wrap (for longer text)."""
        self.set_xy(x + 2, y + 1.5)
        self.set_font("Helvetica", "B", 7.5)
        self._tc(*BLACK)
        self.cell(w - 3, 4, label)

        self.set_xy(x + 2, y + 6)
        self.set_font("Helvetica", "", 8.5)
        self.multi_cell(w - 3, 4, value or "-")

    def _row2(self, y: float, h: float,
              l1: str, v1: str,
              l2: str, v2: str) -> None:
        """Two-column bordered row."""
        self._dc(*BLACK)
        self._lw(0.3)
        self.rect(self.LM, y, self.HALF, h)
        self.rect(self.LM + self.HALF, y, self.HALF, h)
        self._cell_inner(self.LM, y, self.HALF, l1, v1)
        self._cell_inner(self.LM + self.HALF, y, self.HALF, l2, v2)

    def _row2_wrap_left(self, y: float, h: float,
                        l1: str, v1: str,
                        l2: str, v2: str) -> None:
        """Two-column row where the left value may wrap."""
        self._dc(*BLACK)
        self._lw(0.3)
        self.rect(self.LM, y, self.HALF, h)
        self.rect(self.LM + self.HALF, y, self.HALF, h)
        self._cell_inner_wrap(self.LM, y, self.HALF, l1, v1)
        self._cell_inner(self.LM + self.HALF, y, self.HALF, l2, v2)

    def _row1(self, y: float, h: float, label: str, value: str) -> None:
        """Single full-width bordered row (value may wrap)."""
        self._dc(*BLACK)
        self._lw(0.3)
        self.rect(self.LM, y, self.PW, h)
        self.set_xy(self.LM + 2, y + 1.5)
        self.set_font("Helvetica", "B", 7.5)
        self._tc(*BLACK)
        self.cell(self.PW - 3, 4, label)
        self.set_xy(self.LM + 2, y + 6)
        self.set_font("Helvetica", "", 8.5)
        self.multi_cell(self.PW - 3, 4.5, value or "-")

    # ── page sections ────────────────────────────────────────────────────────

    def _header(self) -> float:
        y = 10
        # ── Logo (text) ──────────────────────────────────────────────────
        self.set_xy(self.LM, y)
        self.set_font("Helvetica", "B", 20)
        self._tc(*WATU_BLUE)
        self.cell(22, 10, "watu", new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_font("Helvetica", "", 20)
        self.set_xy(self.LM + 22, y)
        self.cell(25, 10, " simu", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # website
        self.set_xy(self.LM, y + 11)
        self.set_font("Helvetica", "", 6)
        self._tc(*MID)
        self.cell(70, 3.5, "www.watuafrica.com/watu-simu-uganda")

        # colour bar (decorative — approximates the squiggly)
        self._lw(1.8)
        colours = [ORANGE, (34, 197, 94), WATU_BLUE, (234, 179, 8)]
        seg_w = 14
        bx = self.LM
        by = y + 16
        for col in colours:
            self._dc(*col)
            self.line(bx, by, bx + seg_w, by)
            bx += seg_w
        self._lw(0.3)
        self._dc(*BLACK)

        # ── Address block (right-aligned) ────────────────────────────────
        addr = [
            "Watu Credit Uganda LTD,",
            "Plot 2 Bukoto Street,",
            "P.O.Box 113465, Kampala, Uganda",
        ]
        self.set_font("Helvetica", "", 8)
        self._tc(*BLACK)
        for i, line in enumerate(addr):
            self.set_xy(self.LM, y + i * 4.5)
            self.cell(self.PW, 4.5, line, align="R")

        self.set_xy(self.LM, y + len(addr) * 4.5 + 1)
        self.set_font("Helvetica", "B", 8.5)
        self.cell(self.PW, 5, "Contact Center: 0800702200", align="R")

        return y + 20

    def _title(self, y: float) -> float:
        y += 3
        self.set_xy(self.LM, y)
        self.set_font("Helvetica", "B", 11)
        self._tc(*BLACK)
        # Draw underline manually to match real job card
        self.cell(self.PW, 6, "SERVICE ORDER DOC", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        # Underline
        mid_x = self.LM + self.PW / 2
        title_half_w = 40
        self._dc(*BLACK)
        self._lw(0.3)
        self.line(mid_x - title_half_w, y + 6, mid_x + title_half_w, y + 6)
        return y + 9

    def _info_bar(self, y: float) -> float:
        c = self.c
        h = 13
        col = self.PW / 3  # 62mm each
        ec_name = c.ec_location.name if c.ec_location else "-"
        date = _date_str(c.created_at)

        items = [
            ("Job Card No: ", c.reference),
            ("Branch: ", ec_name),
            ("Date: ", date),
        ]
        self._dc(*BLACK)
        self._lw(0.3)
        x = self.LM
        for prefix, value in items:
            self.rect(x, y, col, h)
            # prefix (regular)
            self.set_xy(x + 2, y + 4)
            self.set_font("Helvetica", "", 8)
            self._tc(*BLACK)
            pw = self.get_string_width(prefix)
            self.cell(pw + 1, 5, prefix)
            # value (bold)
            self.set_font("Helvetica", "B", 8.5)
            self.cell(col - pw - 5, 5, value)
            x += col
        return y + h

    def _customer_table(self, y: float) -> float:
        c = self.c
        r = 13   # regular row height
        ra = 17  # taller row for S/C (may wrap)
        rd = 16  # defect row height

        asc = c.asc_name or "-"
        warranty = WARRANTY_LABELS.get(c.warranty_direction or "", "-") if c.warranty_direction else "-"

        self._row2(y, r, "Customer  Name:", c.client_name or "-",
                   "Device IMEI:", c.device_imei or "-")
        y += r

        self._row2(y, r, "Customer Phone No:", c.client_phone or "-",
                   "Sim Tray Available:", _bool_str(c.sim_tray_present))
        y += r

        self._row2(y, r, "Device Model:", c.device_model or "-",
                   "Warranty Status:", warranty)
        y += r

        self._row2_wrap_left(y, ra, "Allocated S/C", asc, "Remarks:", "")
        y += ra

        self._row1(y, rd, "Defect description:", c.complaint or "-")
        y += rd

        return y

    def _terms(self, y: float) -> float:
        y += 4
        self.set_xy(self.LM, y)
        self.set_font("Helvetica", "BU", 7.5)
        self._tc(*BLACK)
        self.cell(0, 4.5, "Terms and conditions:", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(0.5)

        self.set_font("Helvetica", "", 6)
        for i, term in enumerate(TERMS, start=1):
            self.set_x(self.LM)
            self.multi_cell(self.PW, 3, f"{i}. {term}")
            self.ln(0.5)

        return self.get_y()

    def _pin_pattern(self, y: float) -> float:
        c = self.c
        y += 3

        self.set_xy(self.LM, y)
        self.set_font("Helvetica", "", 8)
        self._tc(*BLACK)
        pin_val = c.client_pin if c.client_pin and c.lock_type == "pin" else ""
        self.cell(70, 5, f"Client's Pin/Password:  {pin_val}")

        # Pattern label
        self.set_xy(self.LM + 78, y)
        self.cell(20, 5, "Pattern:")

        # 3×3 dot grid
        dot_start_x = self.LM + 100
        dot_start_y = y - 1
        dot_r = 1.2   # dot radius
        dot_gap = 6   # centre-to-centre spacing
        self._fc(*MID)
        self._dc(*MID)
        self._lw(0.1)
        for row in range(3):
            for col in range(3):
                cx = dot_start_x + col * dot_gap + dot_r
                cy = dot_start_y + row * dot_gap + dot_r
                self.ellipse(cx - dot_r, cy - dot_r, dot_r * 2, dot_r * 2, "F")

        self._dc(*BLACK)
        self._fc(*WHITE)
        return y + 20

    def _signatures(self, y: float) -> float:
        c = self.c
        officer = c.created_by.full_name if c.created_by else "-"

        # Dotted separator line (full width)
        self._dc(*MID)
        self._lw(0.2)
        self.set_dash_pattern(dash=1, gap=1)
        self.line(self.LM, y, self.LM + self.PW, y)
        self.set_dash_pattern()
        self._dc(*BLACK)

        y += 4

        # Client Signature label (left) | Watu Officer Name (right)
        self.set_xy(self.LM, y)
        self.set_font("Helvetica", "", 8)
        self._tc(*BLACK)
        self.cell(self.HALF, 5, "Client Signature:")
        self.set_xy(self.LM + self.HALF, y)
        self.set_font("Helvetica", "", 8)
        self.cell(self.HALF, 5, f"Watu Officer Name: {officer}")

        y += 10
        # Signature lines
        self._lw(0.3)
        self.line(self.LM, y, self.LM + 55, y)

        # Officer signature blank
        self.set_xy(self.LM + self.HALF, y - 5)
        self.set_font("Helvetica", "", 8)
        self.cell(self.HALF, 5, "Watu Officer Signature ______________")

        # Date line (under client signature)
        self.set_xy(self.LM, y + 2)
        self.set_font("Helvetica", "", 8)
        self.cell(55, 5, "Date:")
        self.line(self.LM + 13, y + 6.5, self.LM + 55, y + 6.5)

        return y + 12

    def _cut_line(self, y: float) -> float:
        y += 3
        self._dc(*MID)
        self._lw(0.3)
        self.set_dash_pattern(dash=2, gap=2)
        self.line(self.LM, y, self.LM + self.PW, y)
        self.set_dash_pattern()
        self._dc(*BLACK)
        return y + 4

    def _repair_sticker(self, y: float) -> None:
        c = self.c
        sticker_h = 38

        # Dashed border
        self._dc(*BLACK)
        self._lw(0.3)
        self.set_dash_pattern(dash=2, gap=2)
        self.rect(self.LM, y, self.PW, sticker_h)
        self.set_dash_pattern()

        ix = self.LM + 3
        iy = y + 3

        # Title row: jobcard ref + "watu simu" right
        self.set_xy(ix, iy)
        self.set_font("Helvetica", "B", 8)
        self._tc(*BLACK)
        ref_num = c.reference.split("-")[-1] if "-" in c.reference else c.reference
        self.cell(100, 4.5, f"Repair Sticker  Jobcard no:  {ref_num}")

        self.set_xy(self.LM + self.PW - 45, iy)
        self.set_font("Helvetica", "B", 10)
        self._tc(*WATU_BLUE)
        self.cell(42, 4.5, "watu simu", align="R")
        self._tc(*BLACK)

        iy += 6
        warranty = WARRANTY_LABELS.get(c.warranty_direction or "", "-") if c.warranty_direction else "-"
        ec_name = c.ec_location.name if c.ec_location else "-"

        self.set_font("Helvetica", "", 7)
        lines = [
            f"Device IMEI : {c.device_imei or '-'}",
            f"Device Model: {c.device_model or '-'}",
        ]
        for line in lines:
            self.set_xy(ix, iy)
            self.cell(self.PW - 6, 4, line)
            iy += 4

        # Branch + Warranty on same row
        self.set_xy(ix, iy)
        self.cell(self.HALF - 3, 4, f"Branch: {ec_name}")
        self.set_xy(ix + self.HALF, iy)
        self.cell(self.HALF - 3, 4, f"Warranty Status: {warranty}")
        iy += 4

        # Defect
        self.set_xy(ix, iy)
        self.multi_cell(self.PW - 6, 3.5, f"Defect description: {c.complaint or '-'}")
        iy = self.get_y() + 2

        # Technician's notes
        self.set_xy(ix, iy)
        self.cell(self.PW - 6, 4, "Technician's Notes:___________________________________")

    # ── entry point ──────────────────────────────────────────────────────────

    def build(self) -> bytes:
        self.add_page()
        y = self._header()
        y = self._title(y)
        y = self._info_bar(y)
        y = self._customer_table(y)
        y = self._terms(y)
        y = self._pin_pattern(y)
        y = self._signatures(y)
        y = self._cut_line(y)
        self._repair_sticker(y)

        buf = io.BytesIO()
        self.output(buf)
        return buf.getvalue()


def generate_job_card_pdf(case: "Case") -> bytes:
    return WatuJobCardPDF(case).build()
