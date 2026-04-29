from sqlalchemy import Select, select
from sqlalchemy.orm import Session, selectinload

from app.models.models import LinkedNode, Procedure
from app.schemas.common import CustomerCare, ProcedureSummary, SopLayers
from app.services.samsung_guidance_service import (
    apply_samsung_customer_care,
    apply_samsung_sop_layers,
)

DEFAULT_GREETING = "Start with: 'I'll help you check this step by step.'"
DEFAULT_LISTENING = "Let the customer finish the story before you ask the next question."
DEFAULT_EXPECTATION = (
    "Set expectation: 'We'll do a quick branch check first, then I'll tell you the safest next step.'"
)


def procedure_query() -> Select[tuple[Procedure]]:
    return procedure_query_with()


def procedure_query_with(
    *,
    include_tags: bool = True,
    include_decision_nodes: bool = True,
    include_links: bool = True,
) -> Select[tuple[Procedure]]:
    options = []
    if include_tags:
        options.append(selectinload(Procedure.tags))
    if include_decision_nodes:
        options.append(selectinload(Procedure.decision_nodes))
    if include_links:
        options.append(selectinload(Procedure.links).selectinload(LinkedNode.linked_procedure))
    return select(Procedure).options(*options)


def get_customer_care(procedure: Procedure) -> CustomerCare:
    steps = procedure.steps or {}
    care = steps.get("customer_care", {})
    customer_care = CustomerCare(
        greeting=care.get("greeting", DEFAULT_GREETING),
        listening=care.get("listening", DEFAULT_LISTENING),
        expectation=care.get("expectation", DEFAULT_EXPECTATION),
    )
    return apply_samsung_customer_care(procedure, customer_care)


def get_sop_layers(procedure: Procedure) -> SopLayers:
    steps = procedure.steps or {}
    sop_layers = SopLayers(
        immediate_action=steps.get(
            "immediate_action",
            "Confirm the issue in simple words and continue with guided questions.",
        ),
        explanation=steps.get("explanation"),
        related_actions=steps.get("related_actions", []),
    )
    return apply_samsung_sop_layers(procedure, sop_layers)


def to_summary(procedure: Procedure) -> ProcedureSummary:
    return ProcedureSummary.model_validate(procedure)


def get_related_procedures(db: Session, procedure_id: int) -> list[ProcedureSummary]:
    rows = db.execute(
        select(
            Procedure.id,
            Procedure.title,
            Procedure.category,
            Procedure.description,
            Procedure.outcome,
            Procedure.warranty_status,
        )
        .select_from(LinkedNode)
        .join(Procedure, Procedure.id == LinkedNode.linked_procedure_id)
        .where(LinkedNode.procedure_id == procedure_id)
        .order_by(LinkedNode.id)
    ).all()

    return [
        ProcedureSummary(
            id=procedure_id_value,
            title=title,
            category=category,
            description=description,
            outcome=outcome,
            warranty_status=warranty_status,
        )
        for (
            procedure_id_value,
            title,
            category,
            description,
            outcome,
            warranty_status,
        ) in rows
    ]
