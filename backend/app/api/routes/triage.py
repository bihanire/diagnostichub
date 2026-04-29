from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import get_logger
from app.schemas.triage import (
    TriageNextRequest,
    TriageNextResponse,
    TriageStartRequest,
    TriageStartResponse,
)
from app.services.triage_service import next_triage_step, start_triage

router = APIRouter(prefix="/triage", tags=["triage"])
logger = get_logger("relational_encyclopedia.triage")


@router.post("/start", response_model=TriageStartResponse)
def triage_start(
    request: TriageStartRequest,
    db: Session = Depends(get_db),
) -> TriageStartResponse:
    response = start_triage(db, request.procedure_id)
    if response is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Procedure not found.",
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
    response = next_triage_step(db, request.node_id, request.answer)
    if response is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Decision node not found.",
        )
    logger.debug(
        "triage_advanced",
        extra={
            "event": "triage_advanced",
            "node_id": request.node_id,
        },
    )
    return response
