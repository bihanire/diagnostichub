from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.models import AppUser, Case, CaseNote, ECLocation
from app.schemas.cases import CaseCreateRequest, CaseNoteCreate, CaseNoteItem, CaseResponse, CaseStatsResponse


def _generate_reference(db: Session, ec_location_id: int, country_code: str) -> str:
    loc = db.scalar(select(ECLocation).where(ECLocation.id == ec_location_id))
    if loc is None:
        raise ValueError(f"EC location {ec_location_id} not found")
    loc.job_card_sequence += 1
    db.flush()
    year = datetime.now(UTC).year
    return f"EC-{country_code.upper()}-{year}-{loc.job_card_sequence:04d}"


def create_case(db: Session, user: AppUser, payload: CaseCreateRequest) -> Case:
    country = user.country_code or (
        user.ec_location.country_code if user.ec_location else "UGA"
    )
    reference = _generate_reference(db, user.ec_location_id, country)  # type: ignore[arg-type]
    now = datetime.now(UTC)
    case = Case(
        reference=reference,
        case_type=payload.case_type,
        ec_location_id=user.ec_location_id,
        created_by_id=user.id,
        client_name=payload.client_name,
        client_phone=payload.client_phone,
        client_alt_phone=payload.client_alt_phone,
        client_id_number=payload.client_id_number,
        device_model=payload.device_model,
        device_imei=payload.device_imei,
        complaint=payload.complaint,
        sim_tray_present=payload.sim_tray_present,
        lock_type=payload.lock_type,
        client_pin=payload.client_pin,
        pattern_sequence=payload.pattern_sequence,
        sym_code=payload.sym_code,
        src_group=payload.src_group,
        defect_description=payload.defect_description,
        warranty_direction=payload.warranty_direction,
        wty_exception=payload.wty_exception,
        liquid_exposure=payload.liquid_exposure,
        drop_or_repair=payload.drop_or_repair,
        sw_update=payload.sw_update,
        normal_use=payload.normal_use,
        asc_name=payload.asc_name,
        asc_code=payload.asc_code,
        ls_code=payload.ls_code,
        status="open",
        submitted_at=now,
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    from app.services.sheets_service import append_case_row
    append_case_row(case)

    from app.services.notification_service import send_new_case_notification
    send_new_case_notification(case)

    return case


_CROSS_EC_ROLES = frozenset({"watu_ops", "watu_admin"})


def list_cases(
    db: Session,
    user: AppUser,
    *,
    status: str | None = None,
    q: str | None = None,
    ec_location_id: int | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Case], int]:
    from sqlalchemy import or_

    page = max(1, page)
    per_page = min(max(1, per_page), 100)

    base = select(Case)
    if user.role not in _CROSS_EC_ROLES:
        base = base.where(Case.ec_location_id == user.ec_location_id)
    elif ec_location_id is not None:
        base = base.where(Case.ec_location_id == ec_location_id)

    if status:
        base = base.where(Case.status == status)

    if q:
        term = f"%{q.strip()}%"
        base = base.where(
            or_(
                Case.reference.ilike(term),
                Case.client_name.ilike(term),
                Case.device_imei.ilike(term),
                Case.device_model.ilike(term),
            )
        )

    count_stmt = base.with_only_columns(func.count(Case.id)).order_by(None)
    total = db.scalar(count_stmt) or 0
    cases = list(
        db.scalars(
            base.order_by(Case.created_at.desc())
                .offset((page - 1) * per_page)
                .limit(per_page)
        ).all()
    )
    return cases, total


def get_case_stats_for_location(db: Session, user: AppUser) -> CaseStatsResponse:
    stmt = select(Case.status, func.count(Case.id).label("n")).group_by(Case.status)
    if user.role not in _CROSS_EC_ROLES:
        stmt = stmt.where(Case.ec_location_id == user.ec_location_id)
    rows = db.execute(stmt).all()
    counts: dict[str, int] = {r.status: r.n for r in rows}
    return CaseStatsResponse(
        open=counts.get("open", 0),
        dispatched=counts.get("dispatched", 0),
        closed=counts.get("closed", 0),
        cancelled=counts.get("cancelled", 0),
        total=sum(counts.values()),
    )


def get_case_by_reference(db: Session, reference: str, user: AppUser) -> Case | None:
    case = db.scalar(select(Case).where(Case.reference == reference))
    if case is None:
        return None
    if user.role in ("watu_ops", "watu_admin"):
        return case
    if case.ec_location_id == user.ec_location_id:
        return case
    return None


VALID_TRANSITIONS: dict[str, set[str]] = {
    "open": {"dispatched", "cancelled"},
    "dispatched": {"closed", "cancelled"},
    "closed": set(),
    "cancelled": set(),
}


def update_case_status(
    db: Session, case: Case, new_status: str, user: AppUser, waybill_number: str | None = None
) -> Case:
    allowed = VALID_TRANSITIONS.get(case.status, set())
    if new_status not in allowed:
        raise ValueError(
            f"Cannot transition case from '{case.status}' to '{new_status}'."
        )
    case.status = new_status
    if waybill_number is not None:
        case.waybill_number = waybill_number
    db.commit()
    db.refresh(case)

    from app.services.sheets_service import update_case_status_row
    update_case_status_row(case)

    if new_status == "dispatched":
        from app.services.aramex_service import fire_dispatch_webhook
        fire_dispatch_webhook(case)

    agent = case.created_by
    if agent and agent.email:
        from app.core.config import get_settings
        from app.services.email_service import send_case_status_email
        send_case_status_email(case, new_status, agent.email, agent.full_name, get_settings())

    return case


def to_case_response(case: Case, include_notes: bool = True) -> CaseResponse:
    data = CaseResponse.model_validate(case)
    data.ec_location_name = case.ec_location.name if case.ec_location else None
    if include_notes:
        data.notes = [
            CaseNoteItem(
                id=n.id,
                case_id=n.case_id,
                user_id=n.user_id,
                author_name=n.user.full_name if n.user else "Unknown",
                note=n.note,
                created_at=n.created_at,
            )
            for n in (case.case_notes or [])
        ]
    return data


def add_case_note(db: Session, case: Case, user: AppUser, payload: CaseNoteCreate) -> CaseNote:
    note_text = payload.note.strip()
    if not note_text:
        raise ValueError("Note cannot be empty.")
    note = CaseNote(case_id=case.id, user_id=user.id, note=note_text)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note
