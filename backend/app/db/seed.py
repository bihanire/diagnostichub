from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError

from app.core.database import Base, SessionLocal, engine
from app.db.sample_data import SAMPLE_PROCEDURES
from app.models.models import (
    ChecklistItem,
    DecisionNode,
    Device,
    ECLocation,
    LinkedNode,
    Procedure,
    RepairPart,
    Tag,
)

# ── Device catalogue (Uganda SKUs confirmed) ─────────────────────────────────
# bom_version is NULL until confirmed with Transtel / Samsung iPaaS.
_DEVICES = [
    {"model_name": "A04e", "samsung_code": "SM-A042F", "storage_gb": 32,  "ram_gb": 3, "auto_blocker_required": False, "display_label": "A04e (SM-A042F) 32GB",  "sort_order": 1},
    {"model_name": "A05",  "samsung_code": "SM-A055F", "storage_gb": 64,  "ram_gb": 4, "auto_blocker_required": False, "display_label": "A05 (SM-A055F) 64GB",   "sort_order": 2},
    {"model_name": "A05",  "samsung_code": "SM-A055F", "storage_gb": 128, "ram_gb": 4, "auto_blocker_required": False, "display_label": "A05 (SM-A055F) 128GB",  "sort_order": 3},
    {"model_name": "A05s", "samsung_code": "SM-A057F", "storage_gb": 64,  "ram_gb": 4, "auto_blocker_required": False, "display_label": "A05s (SM-A057F) 64GB",  "sort_order": 4},
    {"model_name": "A05s", "samsung_code": "SM-A057F", "storage_gb": 128, "ram_gb": 4, "auto_blocker_required": False, "display_label": "A05s (SM-A057F) 128GB", "sort_order": 5},
    {"model_name": "A06",  "samsung_code": "SM-A065F", "storage_gb": 64,  "ram_gb": 4, "auto_blocker_required": False, "display_label": "A06 (SM-A065F) 64GB",   "sort_order": 6},
    {"model_name": "A06",  "samsung_code": "SM-A065F", "storage_gb": 128, "ram_gb": 4, "auto_blocker_required": False, "display_label": "A06 (SM-A065F) 128GB",  "sort_order": 7},
    {"model_name": "A07",  "samsung_code": "SM-A075F", "storage_gb": 64,  "ram_gb": 3, "auto_blocker_required": False, "display_label": "A07 (SM-A075F) 64GB",   "sort_order": 8},
    {"model_name": "A07",  "samsung_code": "SM-A075F", "storage_gb": 128, "ram_gb": 4, "auto_blocker_required": False, "display_label": "A07 (SM-A075F) 128GB",  "sort_order": 9},
    # A15, A16, A17 run One UI 6.0+ — Auto Blocker must be disabled before dispatch.
    {"model_name": "A15",  "samsung_code": "SM-A155F", "storage_gb": 128, "ram_gb": 6, "auto_blocker_required": True,  "display_label": "A15 (SM-A155F) 128GB",  "sort_order": 10},
    {"model_name": "A16",  "samsung_code": "SM-A165F", "storage_gb": 128, "ram_gb": 6, "auto_blocker_required": True,  "display_label": "A16 (SM-A165F) 128GB",  "sort_order": 11},
    {"model_name": "A17",  "samsung_code": "SM-A175F", "storage_gb": 128, "ram_gb": 6, "auto_blocker_required": True,  "display_label": "A17 (SM-A175F) 128GB",  "sort_order": 12},
]

# ── Evidence checklist items (per-procedure) ──────────────────────────────────
# procedure_id matches procedures 1-17 in sample_data.py.
# checklist_phase="evidence" — shown during the diagnostic dispatch gate.
def _ev(procedure_id: int, items: list[str]) -> list[dict]:
    return [
        {"procedure_id": procedure_id, "item_text": t, "sort_order": i + 1,
         "checklist_phase": "evidence", "applicable_warranty_direction": None}
        for i, t in enumerate(items)
    ]

_CHECKLIST_EVIDENCE: list[dict] = (
    _ev(1, [
        "Confirm a known-good charger and cable were tested.",
        "Record whether a forced restart was attempted and what happened.",
        "Note any heat, liquid, swelling, or sudden shutdown history.",
        "Capture the exact startup sign: no life, vibration only, logo loop, or charging symbol.",
        "Take photos of the screen and frame condition before handover.",
    ]) +
    _ev(2, [
        "Capture clear photos of the display and any visible impact points.",
        "Confirm whether the symptom is seen outside one app after a restart.",
        "Record touch response, flicker, lines, black screen, or color tint separately.",
        "Note any drop, pressure, or liquid history before dispatch.",
    ]) +
    _ev(3, [
        "Record the IMEI, loan number, and proof of ownership before escalation.",
        "Confirm whether the SIM is blocked and remote account protection steps were explained.",
        "Note whether a police abstract exists and which legal status request is needed.",
        "Upload or attach all theft-supporting documents before moving the case.",
    ]) +
    _ev(4, [
        "Confirm a known-good charger and cable were tested on the device.",
        "Record whether the charging port is loose, dirty, wet, or physically damaged.",
        "Note whether the battery still falls while the phone is connected to power.",
        "Capture any moisture warning, overheating, or power-drop behavior seen at branch.",
    ]) +
    _ev(5, [
        "Record whether the phone is swollen, too hot to handle, or unsafe to keep charging.",
        "Note the charger used, charging environment, and when the heat starts.",
        "Capture any battery smell, lifting back cover, or rapid shutdown behavior.",
        "Stop unsafe handling and log the exact safety risk before dispatch.",
    ]) +
    _ev(6, [
        "Record the battery drain pattern, screen-on use, and standby behavior.",
        "Confirm whether Battery and device care or battery usage was checked.",
        "Note any suspect app, recent update, or heat pattern linked to the drain.",
        "Confirm the issue repeated after branch guidance rather than on one short test only.",
    ]) +
    _ev(7, [
        "Record whether the issue happens in one app or across several apps.",
        "Confirm restart, cache clear, update, and storage checks were completed.",
        "Note whether Safe mode or a clean app test changed the behavior.",
        "Capture the exact freeze pattern before repair intake or escalation.",
    ]) +
    _ev(8, [
        "Record the restart pattern, frequency, and whether the phone enters Safe mode by itself.",
        "Confirm case removal, side-key checks, and recent app or update review were done.",
        "Note whether the restart continues after branch-level software checks.",
        "Capture any heat, liquid, impact, or boot-loop signs before dispatch.",
    ]) +
    _ev(9, [
        "Confirm another known-good active SIM was tested in the same location.",
        "Record whether the issue affects calls, SMS, mobile data, or full network registration.",
        "Note the outcome of network reset or manual network search if attempted.",
        "Capture tray damage, frame damage, or liquid history before sending the device out.",
    ]) +
    _ev(10, [
        "Confirm the issue was tested with speaker, earpiece, microphone, call, and recording paths.",
        "Record whether Bluetooth, earphones, mute state, or app-specific audio routing was cleared.",
        "Note whether the failure stays after trying another app or call path.",
        "Capture any liquid, impact, or mesh blockage signs before escalation.",
    ]) +
    _ev(11, [
        "Record proof-of-ownership status before any password or FRP escalation.",
        "Note whether the case is forgotten password, FRP after reset, or a managed-device lock.",
        "Confirm the customer understands the out-warranty password-processing charge where applicable.",
        "Request and record the correct legal status before dispatching the case.",
    ]) +
    _ev(12, [
        "Capture photos of all visible damage and affected sides of the device.",
        "Record whether the issue followed impact, water, heat, or unauthorized repair handling.",
        "Separate visible external damage from hidden symptom complaints in the notes.",
        "Confirm the out-warranty routing path before dispatching the device.",
    ]) +
    _ev(13, [
        "Confirm the ticket path, legal status request, and receiver destination match the case type.",
        "Upload scanned copies of all co-signed documents before dispatch.",
        "Record incoming and outgoing movement in the branch tracking sheet.",
        "Attach stickers, waybill details, and IMEI records before handover.",
    ]) +
    _ev(14, [
        "Confirm minimum 10 weekly payments and the correct stolen or BER status before proceeding.",
        "Record theft-proof or BER return evidence in the case notes.",
        "Check whether the customer already received one replacement before approval.",
        "Prepare the OBS and handover requirements before moving the replacement request.",
    ]) +
    _ev(15, [
        "Confirm arrears status, IDs, and signed-transfer requirements before escalation.",
        "Record whether the case is a transfer, death case, or loan reschedule.",
        "Attach repair-centre proof and the status timeline for reschedule requests.",
        "Keep missing conditions visible in the notes before handing off the case.",
    ]) +
    _ev(16, [
        "Record IMEI, loan account, return condition, and refund-eligibility checks before handover.",
        "Confirm the password and factory reset requirement was handled where policy allows.",
        "Attach third-party recovery details or ownership verification evidence when relevant.",
        "Note every deduction or non-refundable condition clearly before escalation.",
    ]) +
    _ev(17, [
        "Confirm the branch checks in this flow were completed and recorded.",
        "Capture the exact symptom, repeat pattern, and any visible damage before handover.",
        "Attach the right documents, photos, and identifiers before moving the device.",
    ])
)

# ── Pre-dispatch checklist items (universal + warranty-direction-specific) ────
# procedure_id=None → applies to all dispatched cases.
# checklist_phase="pre_dispatch" — shown on the result page dispatch section.
# applicable_warranty_direction: None=all, "IW"=in-warranty only, "OW"=out-of-warranty only.
_CHECKLIST_PREDISPATCH: list[dict] = [
    {"procedure_id": None, "item_text": "Job card printed, fully completed (PIN recorded), and signed by both parties.", "sort_order": 1, "checklist_phase": "pre_dispatch", "applicable_warranty_direction": None},
    {"procedure_id": None, "item_text": "Job card scanned and uploaded to the branch tracking system.", "sort_order": 2, "checklist_phase": "pre_dispatch", "applicable_warranty_direction": None},
    {"procedure_id": None, "item_text": "LDI (liquid damage indicator) result recorded in case notes.", "sort_order": 3, "checklist_phase": "pre_dispatch", "applicable_warranty_direction": None},
    {"procedure_id": None, "item_text": "Device sticker affixed — IMEI and case reference clearly visible.", "sort_order": 4, "checklist_phase": "pre_dispatch", "applicable_warranty_direction": None},
    {"procedure_id": None, "item_text": "No accessories in package — SIM card, charger, cable, and case removed.", "sort_order": 5, "checklist_phase": "pre_dispatch", "applicable_warranty_direction": None},
    {"procedure_id": None, "item_text": "Device wrapped securely in bubble wrap.", "sort_order": 6, "checklist_phase": "pre_dispatch", "applicable_warranty_direction": None},
    {"procedure_id": None, "item_text": "IMEI written clearly on the waybill.", "sort_order": 7, "checklist_phase": "pre_dispatch", "applicable_warranty_direction": None},
    {"procedure_id": None, "item_text": "Aramex pickup email sent to HQ (upcountry branches only).", "sort_order": 8, "checklist_phase": "pre_dispatch", "applicable_warranty_direction": None},
    {"procedure_id": None, "item_text": "Self Repairs LS logged in MIFOS before handing device to courier.", "sort_order": 9, "checklist_phase": "pre_dispatch", "applicable_warranty_direction": "IW"},
    {"procedure_id": None, "item_text": "Watu Repairs LS confirmed with supervisor and logged in MIFOS.", "sort_order": 10, "checklist_phase": "pre_dispatch", "applicable_warranty_direction": "OW"},
    {"procedure_id": None, "item_text": "30/70 eligibility confirmed and documented — do not dispatch without supervisor sign-off.", "sort_order": 11, "checklist_phase": "pre_dispatch", "applicable_warranty_direction": "OW"},
]

# ── Repair parts prediction (T-code → likely part) ───────────────────────────
# applies_to_warranty: None=both, "IW"=in-warranty, "OW"=out-of-warranty only.
_REPAIR_PARTS: list[dict] = [
    {"t_code": "T12", "part_name": "Main board / power IC",           "part_category": "board",        "applies_to_warranty": None, "sort_order": 1},
    {"t_code": "T14", "part_name": "Battery",                         "part_category": "battery",      "applies_to_warranty": None, "sort_order": 1},
    {"t_code": "T16", "part_name": "Software reload (no part)",       "part_category": "software",     "applies_to_warranty": None, "sort_order": 1},
    {"t_code": "T21", "part_name": "Display assembly (LCD/OLED)",     "part_category": "display",      "applies_to_warranty": None, "sort_order": 1},
    {"t_code": "T22", "part_name": "Inspect on teardown (varies)",    "part_category": "physical",     "applies_to_warranty": None, "sort_order": 1},
    {"t_code": "T31", "part_name": "Charging sub-board (USB port)",   "part_category": "board",        "applies_to_warranty": None, "sort_order": 1},
    {"t_code": "T33", "part_name": "Battery",                         "part_category": "battery",      "applies_to_warranty": None, "sort_order": 1},
    {"t_code": "T35", "part_name": "Battery",                         "part_category": "battery",      "applies_to_warranty": None, "sort_order": 1},
    {"t_code": "T41", "part_name": "Camera module",                   "part_category": "camera",       "applies_to_warranty": None, "sort_order": 1},
    {"t_code": "T51", "part_name": "Speaker / microphone",            "part_category": "audio",        "applies_to_warranty": None, "sort_order": 1},
    {"t_code": "T61", "part_name": "SIM tray / antenna",              "part_category": "connectivity", "applies_to_warranty": None, "sort_order": 1},
    {"t_code": "T01", "part_name": "Service fee (FRP unlock)",        "part_category": "service",      "applies_to_warranty": "OW", "sort_order": 1},
    {"t_code": "T02", "part_name": "Accessory consultation fee",      "part_category": "service",      "applies_to_warranty": "OW", "sort_order": 1},
    {"t_code": "T03", "part_name": "Settings assistance fee",         "part_category": "service",      "applies_to_warranty": "OW", "sort_order": 1},
]


def create_schema() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_procedure_schema()
    ensure_feedback_schema()


def ensure_procedure_schema() -> None:
    additions = [
        (
            "src_group",
            "ALTER TABLE procedures ADD COLUMN src_group VARCHAR(30)",
            "ALTER TABLE procedures ADD COLUMN src_group VARCHAR(30)",
        ),
        (
            "primary_t_code",
            "ALTER TABLE procedures ADD COLUMN primary_t_code VARCHAR(10)",
            "ALTER TABLE procedures ADD COLUMN primary_t_code VARCHAR(10)",
        ),
    ]

    dialect = engine.dialect.name
    with engine.begin() as connection:
        inspector = inspect(connection)
        try:
            existing_columns = {column["name"] for column in inspector.get_columns("procedures")}
        except Exception:
            existing_columns = set()

        for column_name, sqlite_sql, default_sql in additions:
            if column_name in existing_columns:
                continue
            connection.execute(text(sqlite_sql if dialect == "sqlite" else default_sql))
            existing_columns.add(column_name)


def ensure_feedback_schema() -> None:
    additions = [
        (
            "feedback_tags",
            "ALTER TABLE feedback_entries ADD COLUMN feedback_tags JSON DEFAULT '[]'",
            "ALTER TABLE feedback_entries ADD COLUMN feedback_tags JSONB NOT NULL DEFAULT '[]'::jsonb",
        ),
        (
            "triage_trace",
            "ALTER TABLE feedback_entries ADD COLUMN triage_trace JSON",
            "ALTER TABLE feedback_entries ADD COLUMN triage_trace JSONB",
        ),
        (
            "final_decision_label",
            "ALTER TABLE feedback_entries ADD COLUMN final_decision_label VARCHAR(120)",
            "ALTER TABLE feedback_entries ADD COLUMN final_decision_label VARCHAR(120)",
        ),
        (
            "search_confidence",
            "ALTER TABLE feedback_entries ADD COLUMN search_confidence FLOAT",
            "ALTER TABLE feedback_entries ADD COLUMN search_confidence DOUBLE PRECISION",
        ),
        (
            "search_confidence_state",
            "ALTER TABLE feedback_entries ADD COLUMN search_confidence_state VARCHAR(40)",
            "ALTER TABLE feedback_entries ADD COLUMN search_confidence_state VARCHAR(40)",
        ),
    ]

    dialect = engine.dialect.name
    with engine.begin() as connection:
        inspector = inspect(connection)
        try:
            existing_columns = {
                column["name"] for column in inspector.get_columns("feedback_entries")
            }
        except Exception:
            existing_columns = set()

        for column_name, sqlite_sql, default_sql in additions:
            if column_name in existing_columns:
                continue
            connection.execute(text(sqlite_sql if dialect == "sqlite" else default_sql))
            existing_columns.add(column_name)


def seed_devices(db) -> None:
    if db.scalar(select(Device).limit(1)) is not None:
        return
    for row in _DEVICES:
        db.add(Device(**row))
    db.flush()


def seed_checklist_items(db) -> None:
    if db.scalar(select(ChecklistItem).limit(1)) is not None:
        return
    for row in _CHECKLIST_EVIDENCE + _CHECKLIST_PREDISPATCH:
        db.add(ChecklistItem(**row))
    db.flush()


def seed_repair_parts(db) -> None:
    if db.scalar(select(RepairPart).limit(1)) is not None:
        return
    for row in _REPAIR_PARTS:
        db.add(RepairPart(**row))
    db.flush()


def seed_session(db) -> None:
    existing_procedures = {
        procedure.id: procedure for procedure in db.scalars(select(Procedure)).all()
    }

    for procedure_data in SAMPLE_PROCEDURES:
        procedure = existing_procedures.get(procedure_data["id"])
        if procedure is None:
            procedure = Procedure(id=procedure_data["id"])
            db.add(procedure)
            existing_procedures[procedure.id] = procedure

        procedure.title = procedure_data["title"]
        procedure.category = procedure_data["category"]
        procedure.description = procedure_data["description"]
        procedure.steps = procedure_data["steps"]
        procedure.outcome = procedure_data["outcome"]
        procedure.warranty_status = procedure_data["warranty_status"]
        procedure.src_group = procedure_data.get("src_group")
        procedure.primary_t_code = procedure_data.get("primary_t_code")

    db.flush()

    existing_tag_pairs = set(db.execute(select(Tag.keyword, Tag.procedure_id)).all())
    existing_nodes = {node.id: node for node in db.scalars(select(DecisionNode)).all()}
    existing_link_pairs = set(
        db.execute(select(LinkedNode.procedure_id, LinkedNode.linked_procedure_id)).all()
    )
    node_relationships: list[tuple[DecisionNode, int | None, int | None]] = []

    for procedure_data in SAMPLE_PROCEDURES:
        for keyword in procedure_data["tags"]:
            tag_key = (keyword, procedure_data["id"])
            if tag_key in existing_tag_pairs:
                continue

            db.add(Tag(keyword=keyword, procedure_id=procedure_data["id"]))
            existing_tag_pairs.add(tag_key)

        for node_data in procedure_data["nodes"]:
            node = existing_nodes.get(node_data["id"])
            if node is None:
                # Create nodes first with blank relationships so self-referencing
                # decision trees can be inserted safely in PostgreSQL.
                node = DecisionNode(
                    id=node_data["id"],
                    procedure_id=procedure_data["id"],
                    question=node_data["question"],
                    yes_next=None,
                    no_next=None,
                    final_outcome=node_data["final_outcome"],
                )
                db.add(node)
                existing_nodes[node.id] = node
            else:
                node.procedure_id = procedure_data["id"]
                node.question = node_data["question"]
                node.final_outcome = node_data["final_outcome"]

            node_relationships.append((node, node_data["yes_next"], node_data["no_next"]))

    db.flush()

    for node, yes_next, no_next in node_relationships:
        node.yes_next = yes_next
        node.no_next = no_next

    for procedure_data in SAMPLE_PROCEDURES:
        for linked_procedure_id in procedure_data["links"]:
            link_key = (procedure_data["id"], linked_procedure_id)
            if link_key in existing_link_pairs:
                continue

            db.add(
                LinkedNode(
                    procedure_id=procedure_data["id"],
                    linked_procedure_id=linked_procedure_id,
                )
            )
            existing_link_pairs.add(link_key)


# ── EC Locations — SIMU UG Dealership Collection Points (Uganda) ──────────────
# Source: "SIMU UG: Dealership Collection Points for Aftersales — Collection Points" sheet
# is_active: True = Active / Active SVC, False = Not active
# country_code: ISO 3166-1 alpha-3
_EC_LOCATIONS = [
    # ── Kampala ───────────────────────────────────────────────────────────────
    {"name": "Hosha Services Ltd.",                    "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": True,  "sort_order": 1},
    {"name": "Wanna Group Uganda Limited",             "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": True,  "sort_order": 2},
    {"name": "Jovanda Establishments",                 "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": True,  "sort_order": 4},
    {"name": "Ethany Mobiphone Shop Uganda",           "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": False, "sort_order": 7},
    {"name": "Zetu Gadgets Smc Limited",               "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": True,  "sort_order": 8},
    {"name": "Nkashaba Davis Enterprise",              "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": False, "sort_order": 11},
    {"name": "Gadget Fix Investments Limited",         "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": False, "sort_order": 12},
    {"name": "Shenjen Agency — Kampala",               "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": True,  "sort_order": 15},
    {"name": "Owen Phones Uganda",                     "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": True,  "sort_order": 17},
    {"name": "Mamyrama Consults",                      "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": False, "sort_order": 18},
    {"name": "Banja Phone Dealers",                    "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": False, "sort_order": 19},
    {"name": "Muzanganda Phone and Accessories",       "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": False, "sort_order": 20},
    {"name": "Victorious Gadget Consultants",          "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": False, "sort_order": 25},
    {"name": "Newera Technologies — Kampala",          "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": True,  "sort_order": 26},
    {"name": "Field Land Communications — Bukoto",    "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": True,  "sort_order": 29},
    {"name": "Ian Peace Solutions",                    "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": True,  "sort_order": 30},
    {"name": "Sadik Kizza And Family Mobile Comm.",    "city": "Kampala",    "country_code": "UGA", "region": "Kampala",       "is_active": False, "sort_order": 31},
    # ── Kampala East ─────────────────────────────────────────────────────────
    {"name": "Nassuna Phones",                         "city": "Kayunga",    "country_code": "UGA", "region": "Kampala East",  "is_active": True,  "sort_order": 3},
    {"name": "Nvuma Phones",                           "city": "Kayunga",    "country_code": "UGA", "region": "Kampala East",  "is_active": True,  "sort_order": 9},
    {"name": "Field Land Communications — Mukono",    "city": "Mukono",     "country_code": "UGA", "region": "Kampala East",  "is_active": True,  "sort_order": 10},
    {"name": "Assis Electronics",                      "city": "Mukono",     "country_code": "UGA", "region": "Kampala East",  "is_active": True,  "sort_order": 13},
    {"name": "Shenjen Agency — Mukono",                "city": "Mukono",     "country_code": "UGA", "region": "Kampala East",  "is_active": True,  "sort_order": 14},
    {"name": "Amaal Telecoms Company Limited",         "city": "Kayunga",    "country_code": "UGA", "region": "Kampala East",  "is_active": True,  "sort_order": 16},
    {"name": "Kironde Phone Gadgets",                  "city": "Kayunga",    "country_code": "UGA", "region": "Kampala East",  "is_active": True,  "sort_order": 22},
    {"name": "Danezi and Family Enterprises",          "city": "Mukono",     "country_code": "UGA", "region": "Kampala East",  "is_active": True,  "sort_order": 27},
    {"name": "Nogasha Cash Point",                     "city": "Lugazi",     "country_code": "UGA", "region": "Kampala East",  "is_active": False, "sort_order": 59},
    # ── Central North ────────────────────────────────────────────────────────
    {"name": "Makankana Phones and Accessories",       "city": "Matugga",    "country_code": "UGA", "region": "Central North", "is_active": False, "sort_order": 21},
    {"name": "Noni Phone World",                       "city": "Luweero",    "country_code": "UGA", "region": "Central North", "is_active": False, "sort_order": 23},
    {"name": "Chozzo Phones & Gadget Center",          "city": "Luweero",    "country_code": "UGA", "region": "Central North", "is_active": True,  "sort_order": 24},
    {"name": "Katongole Robert",                       "city": "Luweero",    "country_code": "UGA", "region": "Central North", "is_active": True,  "sort_order": 28},
    {"name": "Kivumbi Badru",                          "city": "Bombo",      "country_code": "UGA", "region": "Central North", "is_active": False, "sort_order": 39},
    # ── Eastern ──────────────────────────────────────────────────────────────
    {"name": "Shamuha Shak Business Solutions",        "city": "Jinja",      "country_code": "UGA", "region": "Eastern",       "is_active": True,  "sort_order": 5},
    {"name": "Newera Technologies — Jinja",            "city": "Jinja",      "country_code": "UGA", "region": "Eastern",       "is_active": True,  "sort_order": 6},
    {"name": "Newera Technologies — Iganga",           "city": "Iganga",     "country_code": "UGA", "region": "Eastern",       "is_active": True,  "sort_order": 32},
    {"name": "Gaza Land General Traders",              "city": "Iganga",     "country_code": "UGA", "region": "Eastern",       "is_active": True,  "sort_order": 33},
    {"name": "Deno Sales Phone Centre",                "city": "Iganga",     "country_code": "UGA", "region": "Eastern",       "is_active": False, "sort_order": 34},
    {"name": "Newera Technologies — Tororo",           "city": "Tororo",     "country_code": "UGA", "region": "Eastern",       "is_active": True,  "sort_order": 35},
    {"name": "Henza General Investments",              "city": "Magamaga",   "country_code": "UGA", "region": "Eastern",       "is_active": True,  "sort_order": 61},
    {"name": "Tricia Rainz Enterprises — Jinja",      "city": "Jinja",      "country_code": "UGA", "region": "Eastern",       "is_active": True,  "sort_order": 66},
    {"name": "Tricia Rainz Enterprises — Namayingo",  "city": "Namayingo",  "country_code": "UGA", "region": "Eastern",       "is_active": True,  "sort_order": 67},
    {"name": "Tricia Rainz Enterprises — Iganga",     "city": "Iganga",     "country_code": "UGA", "region": "Eastern",       "is_active": True,  "sort_order": 68},
    {"name": "Newera Technologies — Kamuli",           "city": "Kamuli",     "country_code": "UGA", "region": "Eastern",       "is_active": True,  "sort_order": 69},
    {"name": "Praise Techno Smart Phone",              "city": "Mayuge",     "country_code": "UGA", "region": "Eastern",       "is_active": True,  "sort_order": 70},
    # ── North Eastern ────────────────────────────────────────────────────────
    {"name": "Newera Technologies — Soroti",           "city": "Soroti",     "country_code": "UGA", "region": "North Eastern", "is_active": True,  "sort_order": 36},
    {"name": "Enzy Phone Services Uganda",             "city": "Mbale",      "country_code": "UGA", "region": "North Eastern", "is_active": False, "sort_order": 62},
    {"name": "Galactico Connections Limited",          "city": "Mbale",      "country_code": "UGA", "region": "North Eastern", "is_active": True,  "sort_order": 65},
    # ── Northern ─────────────────────────────────────────────────────────────
    {"name": "El-Jemoro Investments",                  "city": "Nebbi",      "country_code": "UGA", "region": "Northern",      "is_active": True,  "sort_order": 37},
    {"name": "EA Electronics",                         "city": "Adjumani",   "country_code": "UGA", "region": "Northern",      "is_active": False, "sort_order": 38},
    {"name": "Banana Life Investment — Pakwach",       "city": "Pakwach",    "country_code": "UGA", "region": "Northern",      "is_active": True,  "sort_order": 44},
    {"name": "Banana Life Investment — Gulu",          "city": "Gulu",       "country_code": "UGA", "region": "Northern",      "is_active": True,  "sort_order": 45},
    {"name": "Banana Life Investment — Arua",          "city": "Arua",       "country_code": "UGA", "region": "Northern",      "is_active": True,  "sort_order": 46},
    # ── Western Mid ──────────────────────────────────────────────────────────
    {"name": "Nakidde Harriet",                        "city": "Bweyale",    "country_code": "UGA", "region": "Western Mid",   "is_active": True,  "sort_order": 40},
    {"name": "Watu Kagadi Satellite",                  "city": "Kagadi",     "country_code": "UGA", "region": "Western Mid",   "is_active": True,  "sort_order": 41},
    # ── Western ──────────────────────────────────────────────────────────────
    {"name": "Kabiito Thomas Enterprises",             "city": "Kyenjojo",   "country_code": "UGA", "region": "Western",       "is_active": True,  "sort_order": 42},
    {"name": "Newera Technologies — Kyenjojo",         "city": "Kyenjojo",   "country_code": "UGA", "region": "Western",       "is_active": True,  "sort_order": 43},
    {"name": "Newera Technologies — Fort Portal",      "city": "Fort Portal", "country_code": "UGA", "region": "Western",      "is_active": True,  "sort_order": 47},
    {"name": "Moyox BG Investment",                    "city": "Bundibugyo", "country_code": "UGA", "region": "Western",       "is_active": True,  "sort_order": 48},
    {"name": "Abdul Rahim Godfrey",                    "city": "Karugutu",   "country_code": "UGA", "region": "Western",       "is_active": True,  "sort_order": 49},
    {"name": "Newera Technologies — Kasese",           "city": "Kasese",     "country_code": "UGA", "region": "Western",       "is_active": True,  "sort_order": 50},
    {"name": "Siraje Ssebyala Enterprises",            "city": "Kasese",     "country_code": "UGA", "region": "Western",       "is_active": True,  "sort_order": 51},
    {"name": "Majo Gadgets Co. Ltd",                   "city": "Fort Portal", "country_code": "UGA", "region": "Western",      "is_active": True,  "sort_order": 63},
    {"name": "Johnbosco & Family Establishments",      "city": "Bunyangabo", "country_code": "UGA", "region": "Western",       "is_active": False, "sort_order": 64},
    # ── South Western ────────────────────────────────────────────────────────
    {"name": "Snap Tech Technopolies Solution",        "city": "Ishaka",     "country_code": "UGA", "region": "South Western", "is_active": True,  "sort_order": 52},
    {"name": "Newera Technologies — Rukungiri",        "city": "Rukungiri",  "country_code": "UGA", "region": "South Western", "is_active": True,  "sort_order": 53},
    {"name": "Rukundo and Emilly Business Solutions",  "city": "Kazo",       "country_code": "UGA", "region": "South Western", "is_active": True,  "sort_order": 54},
    # ── South Central ────────────────────────────────────────────────────────
    {"name": "Kisakyamaria Mob Services — Lyantonde", "city": "Lyantonde",  "country_code": "UGA", "region": "South Central", "is_active": True,  "sort_order": 55},
    {"name": "Kisakyamaria Mob Services — Mbirizi",   "city": "Mbirizi",    "country_code": "UGA", "region": "South Central", "is_active": True,  "sort_order": 56},
    {"name": "Kisakyamaria Mob Services — Masaka",    "city": "Masaka",     "country_code": "UGA", "region": "South Central", "is_active": True,  "sort_order": 57},
    {"name": "Vipo Gadgets",                           "city": "Masaka",     "country_code": "UGA", "region": "South Central", "is_active": True,  "sort_order": 58},
    {"name": "Chloe Phone Center",                     "city": "Mpigi",      "country_code": "UGA", "region": "South Central", "is_active": False, "sort_order": 60},
]


def seed_ec_locations(db) -> None:
    existing_names = {loc.name for loc in db.scalars(select(ECLocation)).all()}
    # If only placeholder data exists, clear it so real data can load cleanly.
    if existing_names and all("placeholder" in n for n in existing_names):
        db.query(ECLocation).delete()
        db.flush()
        existing_names = set()
    for loc in _EC_LOCATIONS:
        if loc["name"] not in existing_names:
            db.add(ECLocation(**loc))


def seed_data() -> None:
    for attempt in range(2):
        with SessionLocal() as db:
            try:
                seed_session(db)
                seed_devices(db)
                seed_checklist_items(db)
                seed_repair_parts(db)
                seed_ec_locations(db)
                db.commit()
                return
            except IntegrityError:
                db.rollback()
                if attempt == 1:
                    raise


if __name__ == "__main__":
    create_schema()
    seed_data()
