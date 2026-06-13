from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import AppUser, Case, ECLocation
from app.schemas.cases import CaseCreateRequest, CaseResponse


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

    return case


def list_cases_for_location(db: Session, user: AppUser) -> list[Case]:
    stmt = (
        select(Case)
        .where(Case.ec_location_id == user.ec_location_id)
        .order_by(Case.created_at.desc())
    )
    return list(db.scalars(stmt).all())


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

    return case


def to_case_response(case: Case) -> CaseResponse:
    return CaseResponse.model_validate(case)
