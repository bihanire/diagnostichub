from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import get_logger
from app.schemas.feedback import (
    BranchFeedbackBreakdownResponse,
    FeedbackCreateRequest,
    FeedbackCreateResponse,
    FeedbackLanguageCandidateResponse,
    FeedbackSummaryResponse,
    FeedbackTagBreakdownResponse,
    ProcedureFeedbackBreakdownResponse,
)
from app.services.feedback_service import (
    create_feedback,
    export_feedback_csv,
    export_feedback_language_candidates_csv,
    get_feedback_by_branch,
    get_feedback_by_procedure,
    get_feedback_by_tag,
    get_feedback_language_candidates,
    get_feedback_summary,
)
from app.services.ops_auth_service import require_ops_session

router = APIRouter(prefix="/feedback", tags=["feedback"])
logger = get_logger("relational_encyclopedia.feedback")


@router.post("", response_model=FeedbackCreateResponse)
def submit_feedback(
    request: FeedbackCreateRequest,
    db: Session = Depends(get_db),
) -> FeedbackCreateResponse:
    try:
        response = create_feedback(db, request)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    logger.info(
        "feedback_saved",
        extra={
            "event": "feedback_saved",
            "procedure_id": request.procedure_id,
            "feedback_id": response.id,
            "helpful": request.helpful,
            "feedback_tags": request.feedback_tags,
            "final_decision_label": request.final_decision_label,
        },
    )
    return response


@router.get("/summary", response_model=FeedbackSummaryResponse)
def feedback_summary(
    days: int = Query(default=30, ge=1, le=365),
    _=Depends(require_ops_session),
    db: Session = Depends(get_db),
) -> FeedbackSummaryResponse:
    return get_feedback_summary(db, days=days)


@router.get("/by-procedure", response_model=ProcedureFeedbackBreakdownResponse)
def feedback_by_procedure(
    days: int = Query(default=30, ge=1, le=365),
    _=Depends(require_ops_session),
    db: Session = Depends(get_db),
) -> ProcedureFeedbackBreakdownResponse:
    return get_feedback_by_procedure(db, days=days)


@router.get("/by-branch", response_model=BranchFeedbackBreakdownResponse)
def feedback_by_branch(
    days: int = Query(default=30, ge=1, le=365),
    _=Depends(require_ops_session),
    db: Session = Depends(get_db),
) -> BranchFeedbackBreakdownResponse:
    return get_feedback_by_branch(db, days=days)


@router.get("/by-tag", response_model=FeedbackTagBreakdownResponse)
def feedback_by_tag(
    days: int = Query(default=30, ge=1, le=365),
    _=Depends(require_ops_session),
    db: Session = Depends(get_db),
) -> FeedbackTagBreakdownResponse:
    return get_feedback_by_tag(db, days=days)


@router.get("/language-candidates", response_model=FeedbackLanguageCandidateResponse)
def feedback_language_candidates(
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=20, ge=1, le=100),
    _=Depends(require_ops_session),
    db: Session = Depends(get_db),
) -> FeedbackLanguageCandidateResponse:
    return get_feedback_language_candidates(db, days=days, limit=limit)


@router.get("/language-candidates/export.csv", response_class=PlainTextResponse)
def feedback_language_candidates_export_csv(
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=50, ge=1, le=500),
    _=Depends(require_ops_session),
    db: Session = Depends(get_db),
) -> PlainTextResponse:
    csv_content = export_feedback_language_candidates_csv(db, days=days, limit=limit)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="feedback-language-candidates-{days}d.csv"'
        },
    )


@router.get("/export.csv", response_class=PlainTextResponse)
def feedback_export_csv(
    days: int = Query(default=30, ge=1, le=365),
    _=Depends(require_ops_session),
    db: Session = Depends(get_db),
) -> PlainTextResponse:
    csv_content = export_feedback_csv(db, days=days)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="feedback-{days}d.csv"'
        },
    )
