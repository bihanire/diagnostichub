from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import get_logger
from app.schemas.search import SearchRequest, SearchResponse
from app.services.search_service import search_procedures
from app.services.telemetry_service import get_telemetry_collector

router = APIRouter(tags=["search"])
logger = get_logger("relational_encyclopedia.search")


@router.post("/search", response_model=SearchResponse)
def search(request: SearchRequest, db: Session = Depends(get_db)) -> SearchResponse:
    response = search_procedures(db, request.query)
    telemetry = get_telemetry_collector()
    telemetry.record_search_outcome(
        issue_type=response.structured_intent.issue_type,
        confidence_state=response.confidence_state,
        no_match=response.no_match,
        needs_review=response.needs_review,
        ambiguity_risk=response.semantic_insight.ambiguity_risk if response.semantic_insight else None,
    )
    telemetry.record_event(
        event="search_completed",
        status="success" if not response.no_match else "review",
        metadata={
            "issue_type": response.structured_intent.issue_type,
            "confidence_state": response.confidence_state,
            "needs_review": response.needs_review,
            "no_match": response.no_match,
        },
    )
    logger.debug(
        "search_completed",
        extra={
            "event": "search_completed",
            "procedure_id": response.best_match.id if response.best_match else None,
            "confidence": response.confidence,
            "confidence_state": response.confidence_state,
            "needs_review": response.needs_review,
        },
    )
    return response
