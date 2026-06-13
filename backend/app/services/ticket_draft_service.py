from app.schemas.ticket_draft import (
    TicketDraftPreviewRequest,
    TicketDraftPreviewResponse,
    TicketDraftRequirementStatus,
)

WEBHOOK_REQUIREMENTS = [
    (
        "signed_delivery",
        "Signed delivery",
        "Required before any external ticket target can trust DiagnosticHub events.",
    ),
    (
        "idempotency_key",
        "Idempotency key",
        "Present in the preview so retries can be made duplicate-safe later.",
    ),
    (
        "retry_and_dead_letter",
        "Retry and dead-letter review",
        "Still needs a real queue or delivery log before live automation.",
    ),
    (
        "privacy_review",
        "Privacy review",
        "Required because case packets can include customer wording from the branch.",
    ),
    (
        "schema_versioning",
        "Schema versioning",
        "Present as diagnostichub.case_packet.v1 so downstream mapping can be stable.",
    ),
]


def preview_ticket_draft(payload: TicketDraftPreviewRequest) -> TicketDraftPreviewResponse:
    blockers = _get_blockers(payload)
    draft_status = "ready_for_operator_review" if not blockers else "blocked"

    return TicketDraftPreviewResponse(
        dry_run=True,
        delivery_enabled=False,
        draft_status=draft_status,
        external_ticket_id=None,
        blockers=blockers,
        ticket_fields={
            "external_reference": payload.idempotencyKey,
            "title": _build_ticket_title(payload),
            "summary": _build_ticket_summary(payload),
            "procedure": payload.procedure.title,
            "family": payload.family.title or payload.family.id or "Not selected",
            "decision": payload.decisionLabel
            or payload.watuDecision.decisionLabel
            or "Not selected",
            "warranty_direction": payload.warrantyDirection
            or payload.watuDecision.warrantyDirection
            or "Not selected",
            "evidence_state": payload.evidenceState,
            "feedback_status": payload.feedbackStatus,
            "knowledge_source_ids": payload.knowledgeSourceIds,
        },
        webhook_requirements=_build_requirement_statuses(payload),
        message=(
            "Ticket draft preview is ready for operator review. No ticket was created."
            if not blockers
            else "Ticket draft preview is blocked. No ticket was created."
        ),
    )


def _get_blockers(payload: TicketDraftPreviewRequest) -> list[str]:
    blockers: list[str] = []
    if payload.eventName != "diagnostic.case.completed":
        blockers.append("Complete triage before drafting a ticket.")
    if payload.ticketReadiness != "ready_for_ticket_draft":
        blockers.append("Case packet is not marked ready for ticket draft.")
    if payload.evidenceState == "pending":
        blockers.append("Evidence checklist is not complete.")
    if payload.deliveryReadiness != "ready_for_operator_review":
        blockers.append("Delivery readiness is not at operator review state.")
    return blockers


def _build_ticket_title(payload: TicketDraftPreviewRequest) -> str:
    decision = payload.decisionLabel or payload.watuDecision.decisionLabel
    if decision:
        return f"{payload.procedure.title} - {decision}"
    return payload.procedure.title


def _build_ticket_summary(payload: TicketDraftPreviewRequest) -> str:
    parts = [
        f"Customer wording: {payload.query}",
        f"Diagnosis: {payload.diagnosis or 'Not available'}",
        f"Recommended action: {payload.recommendation or 'Not available'}",
        f"Evidence: {len(payload.dispatchGateConfirmed)} of {len(payload.evidenceChecklist)} confirmed",
    ]
    return "\n".join(parts)


def _build_requirement_statuses(
    payload: TicketDraftPreviewRequest,
) -> list[TicketDraftRequirementStatus]:
    statuses: list[TicketDraftRequirementStatus] = []
    for requirement_id, label, note in WEBHOOK_REQUIREMENTS:
        ready = requirement_id in {"idempotency_key", "schema_versioning"}
        if requirement_id == "privacy_review":
            ready = payload.privacyClassification == "internal_operational"
        statuses.append(
            TicketDraftRequirementStatus(
                id=requirement_id,
                label=label,
                ready=ready,
                note=note,
            )
        )
    return statuses
