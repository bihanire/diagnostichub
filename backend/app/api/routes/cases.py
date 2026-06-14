from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.auth_deps import get_current_user
from app.core.database import get_db
from app.models.models import AppUser
from app.schemas.cases import (
    CaseCreateRequest,
    CaseListResponse,
    CaseNoteCreate,
    CaseNoteItem,
    CaseResponse,
    CaseStatsResponse,
    CaseStatusUpdateRequest,
    CaseStatusUpdateResponse,
)
from app.services.case_service import (
    add_case_note,
    create_case,
    get_case_by_reference,
    get_case_stats_for_location,
    list_cases_for_location,
    to_case_response,
    update_case_status,
)
from app.services.pdf_service import generate_job_card_pdf

router = APIRouter(prefix="/cases", tags=["cases"])


@router.post("", response_model=CaseResponse)
def submit_case(
    payload: CaseCreateRequest,
    db: Session = Depends(get_db),
    user: AppUser = Depends(get_current_user),
) -> CaseResponse:
    if user.ec_location_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no EC location assigned.",
        )
    case = create_case(db, user, payload)
    return to_case_response(case)


@router.get("", response_model=CaseListResponse)
def list_cases(
    db: Session = Depends(get_db),
    user: AppUser = Depends(get_current_user),
) -> CaseListResponse:
    cases = list_cases_for_location(db, user)
    return CaseListResponse(
        cases=[to_case_response(c) for c in cases],
        total=len(cases),
    )


@router.get("/stats", response_model=CaseStatsResponse)
def get_case_stats(
    db: Session = Depends(get_db),
    user: AppUser = Depends(get_current_user),
) -> CaseStatsResponse:
    return get_case_stats_for_location(db, user)


@router.get("/{reference}", response_model=CaseResponse)
def get_case(
    reference: str,
    db: Session = Depends(get_db),
    user: AppUser = Depends(get_current_user),
) -> CaseResponse:
    case = get_case_by_reference(db, reference, user)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")
    return to_case_response(case)


@router.patch("/{reference}/status", response_model=CaseStatusUpdateResponse)
def patch_case_status(
    reference: str,
    payload: CaseStatusUpdateRequest,
    db: Session = Depends(get_db),
    user: AppUser = Depends(get_current_user),
) -> CaseStatusUpdateResponse:
    case = get_case_by_reference(db, reference, user)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")
    try:
        case = update_case_status(db, case, payload.status, user, payload.waybill_number)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return CaseStatusUpdateResponse(
        message=f"Case {reference} status updated to '{payload.status}'.",
        case=to_case_response(case),
    )


@router.post("/{reference}/notes", response_model=CaseNoteItem, status_code=201)
def add_note(
    reference: str,
    payload: CaseNoteCreate,
    db: Session = Depends(get_db),
    user: AppUser = Depends(get_current_user),
) -> CaseNoteItem:
    case = get_case_by_reference(db, reference, user)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")
    try:
        note = add_case_note(db, case, user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return CaseNoteItem(
        id=note.id,
        case_id=note.case_id,
        user_id=note.user_id,
        author_name=note.user.full_name if note.user else user.full_name,
        note=note.note,
        created_at=note.created_at,
    )


@router.get("/{reference}/pdf")
def download_job_card_pdf(
    reference: str,
    db: Session = Depends(get_db),
    user: AppUser = Depends(get_current_user),
) -> Response:
    case = get_case_by_reference(db, reference, user)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")
    pdf_bytes = generate_job_card_pdf(case)
    filename = f"{reference}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
