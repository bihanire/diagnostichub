from fastapi import APIRouter, Depends

from app.core.logging import get_logger
from app.schemas.telemetry import (
    InteractionEventRequest,
    InteractionEventResponse,
    TelemetrySummaryResponse,
)
from app.services.ops_auth_service import require_ops_session
from app.services.telemetry_service import get_telemetry_collector

router = APIRouter(tags=["telemetry"])
logger = get_logger("relational_encyclopedia.telemetry")


@router.get("/ops/telemetry/summary", response_model=TelemetrySummaryResponse)
def telemetry_summary(_=Depends(require_ops_session)) -> TelemetrySummaryResponse:
    return get_telemetry_collector().snapshot()


@router.post("/telemetry/interaction", response_model=InteractionEventResponse)
def telemetry_interaction(payload: InteractionEventRequest) -> InteractionEventResponse:
    telemetry = get_telemetry_collector()
    telemetry.record_interaction(event=payload.event)
    telemetry.record_event(
        event=f"ux_{payload.event}",
        status=payload.status,
        metadata=payload.metadata,
    )
    logger.debug(
        "telemetry_interaction",
        extra={
            "event": "telemetry_interaction",
            "interaction_event": payload.event,
            "status": payload.status,
        },
    )
    return InteractionEventResponse(accepted=True)
