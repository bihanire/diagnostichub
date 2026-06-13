from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.models import RepairPart
from app.schemas.triage import PartsPredictionItem, PartsPredictionResponse

_DIRECTIONAL_NOTE = (
    "Directional guidance only — not a quote. "
    "Final part confirmed by service centre after teardown inspection."
)


def get_parts_prediction(
    db: Session,
    t_code: str | None,
    warranty_direction: str | None,
) -> PartsPredictionResponse:
    normalised = (t_code or "").upper().strip()

    query = (
        select(RepairPart)
        .where(
            RepairPart.t_code == normalised,
            RepairPart.is_active == True,  # noqa: E712
        )
        .order_by(RepairPart.sort_order, RepairPart.id)
    )

    if warranty_direction:
        query = query.where(
            or_(
                RepairPart.applies_to_warranty == warranty_direction,
                RepairPart.applies_to_warranty.is_(None),
            )
        )

    rows = db.scalars(query).all()
    return PartsPredictionResponse(
        t_code=normalised,
        parts=[PartsPredictionItem(part_name=r.part_name, part_category=r.part_category) for r in rows],
        directional_note=_DIRECTIONAL_NOTE,
    )
