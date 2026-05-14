from fastapi import APIRouter, Depends

from app.core.logging import get_logger
from app.schemas.ticket_draft import TicketDraftPreviewRequest, TicketDraftPreviewResponse
from app.services.ops_auth_service import require_ops_session
from app.services.telemetry_service import get_telemetry_collector
from app.services.ticket_draft_service import preview_ticket_draft

router = APIRouter(prefix="/ops/ticket-draft", tags=["ticket-draft"])
logger = get_logger("relational_encyclopedia.ticket_draft")


@router.post("/preview", response_model=TicketDraftPreviewResponse)
def ticket_draft_preview(
    payload: TicketDraftPreviewRequest,
    _=Depends(require_ops_session),
) -> TicketDraftPreviewResponse:
    response = preview_ticket_draft(payload)
    get_telemetry_collector().record_event(
        event="ticket_draft_previewed",
        status="success" if response.draft_status == "ready_for_operator_review" else "review",
        metadata={
            "draft_status": response.draft_status,
            "delivery_enabled": str(response.delivery_enabled).lower(),
            "procedure_id": str(payload.procedure.id),
        },
    )
    logger.info(
        "ticket_draft_previewed",
        extra={
            "event": "ticket_draft_previewed",
            "draft_status": response.draft_status,
            "procedure_id": payload.procedure.id,
        },
    )
    return response
