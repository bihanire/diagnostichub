from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.family import RepairFamilyDetailResponse, RepairFamilySummary
from app.services.family_service import get_repair_family_detail, list_repair_families

router = APIRouter(prefix="/families", tags=["families"])


@router.get("", response_model=list[RepairFamilySummary])
def families(db: Session = Depends(get_db)) -> list[RepairFamilySummary]:
    return list_repair_families(db)


@router.get("/{family_id}", response_model=RepairFamilyDetailResponse)
def family_detail(family_id: str, db: Session = Depends(get_db)) -> RepairFamilyDetailResponse:
    response = get_repair_family_detail(db, family_id)
    if response is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repair family not found.",
        )
    return response
