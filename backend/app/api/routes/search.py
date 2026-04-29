from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import get_logger
from app.schemas.search import SearchRequest, SearchResponse
from app.services.search_service import search_procedures

router = APIRouter(tags=["search"])
logger = get_logger("relational_encyclopedia.search")


@router.post("/search", response_model=SearchResponse)
def search(request: SearchRequest, db: Session = Depends(get_db)) -> SearchResponse:
    response = search_procedures(db, request.query)
    logger.info(
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
