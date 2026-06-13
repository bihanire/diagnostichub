from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import get_logger
from app.models.models import ChecklistItem
from app.schemas.triage import (
    DeviceListResponse,
    DispatchRouteRequest,
    DispatchRouteResponse,
    PartsPredictionResponse,
    TriageNextRequest,
    TriageNextResponse,
    TriageStartRequest,
    TriageStartResponse,
    WarrantyNextRequest,
    WarrantyNextResponse,
)
from app.services.device_service import get_all_devices
from app.services.dispatch_routing_service import get_dispatch_route
from app.services.parts_service import get_parts_prediction
from app.services.telemetry_service import get_telemetry_collector
from app.services.triage_service import next_triage_step, start_triage
from app.services.warranty_service import evaluate_warranty

router = APIRouter(prefix="/triage", tags=["triage"])
logger = get_logger("relational_encyclopedia.triage")


@router.post("/start", response_model=TriageStartResponse)
def triage_start(
    request: TriageStartRequest,
    db: Session = Depends(get_db),
) -> TriageStartResponse:
    telemetry = get_telemetry_collector()
    response = start_triage(db, request.procedure_id)
    if response is None:
        telemetry.record_event(
            event="triage_start_failed",
            status="error",
            metadata={"procedure_id": request.procedure_id, "reason": "procedure_not_found"},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Procedure not found.",
        )
    telemetry.record_event(
        event="triage_started",
        status="success",
        metadata={
            "procedure_id": request.procedure_id,
            "status": response.status,
            "step": response.progress.step,
            "total": response.progress.total,
        },
    )
    logger.debug(
        "triage_started",
        extra={
            "event": "triage_started",
            "procedure_id": request.procedure_id,
        },
    )
    return response


@router.post("/next", response_model=TriageNextResponse)
def triage_next(
    request: TriageNextRequest,
    db: Session = Depends(get_db),
) -> TriageNextResponse:
    telemetry = get_telemetry_collector()
    response = next_triage_step(db, request.node_id, request.answer)
    if response is None:
        telemetry.record_event(
            event="triage_advanced_failed",
            status="error",
            metadata={"node_id": request.node_id, "reason": "node_not_found"},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Decision node not found.",
        )
    telemetry.record_event(
        event="triage_advanced",
        status="success",
        metadata={
            "node_id": request.node_id,
            "answer": request.answer,
            "status": response.status,
            "step": response.progress.step,
            "total": response.progress.total,
        },
    )
    logger.debug(
        "triage_advanced",
        extra={
            "event": "triage_advanced",
            "node_id": request.node_id,
        },
    )
    return response


@router.post("/warranty", response_model=WarrantyNextResponse)
def triage_warranty(request: WarrantyNextRequest) -> WarrantyNextResponse:
    telemetry = get_telemetry_collector()
    result = evaluate_warranty(request.primary_t_code, request.answers)
    telemetry.record_event(
        event="warranty_evaluated",
        status="success",
        metadata={
            "primary_t_code": request.primary_t_code or "",
            "answer_count": len(request.answers),
            "status": result["status"],
            "auto_skipped": result.get("auto_skipped", False),
        },
    )
    return WarrantyNextResponse(**result)


@router.post("/dispatch-route", response_model=DispatchRouteResponse)
def triage_dispatch_route(
    request: DispatchRouteRequest,
    db: Session = Depends(get_db),
) -> DispatchRouteResponse:
    telemetry = get_telemetry_collector()
    result = get_dispatch_route(
        src_group=request.src_group,
        primary_t_code=request.primary_t_code,
        warranty_direction=request.warranty_direction,
        warranty_needs_review=request.warranty_needs_review,
    )
    telemetry.record_event(
        event="dispatch_routed",
        status="success",
        metadata={
            "dispatch_class": result["dispatch_class"],
            "ls_code": result["ls_code"] or "",
            "escalate": result["escalate"],
        },
    )
    pre_dispatch = _get_pre_dispatch_checklist(db, request.warranty_direction)
    return DispatchRouteResponse(**result, pre_dispatch_checklist=pre_dispatch)


def _get_pre_dispatch_checklist(db: Session, warranty_direction: str | None) -> list[str]:
    rows = db.scalars(
        select(ChecklistItem)
        .where(
            ChecklistItem.checklist_phase == "pre_dispatch",
            ChecklistItem.is_active == True,  # noqa: E712
            or_(
                ChecklistItem.applicable_warranty_direction.is_(None),
                ChecklistItem.applicable_warranty_direction == warranty_direction,
            ),
        )
        .order_by(ChecklistItem.sort_order, ChecklistItem.id)
    ).all()
    return [row.item_text for row in rows]


@router.get("/devices", response_model=DeviceListResponse)
def list_devices(db: Session = Depends(get_db)) -> DeviceListResponse:
    return get_all_devices(db)


@router.get("/parts-prediction", response_model=PartsPredictionResponse)
def parts_prediction(
    t_code: str = Query(default=""),
    warranty_direction: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> PartsPredictionResponse:
    return get_parts_prediction(db, t_code, warranty_direction)
