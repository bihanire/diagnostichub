from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.family import (
    RepairFamilyDetailResponse,
    RepairFamilyLearningModuleResponse,
    RepairFamilySummary,
)
from app.services.family_service import (
    get_repair_family_detail,
    get_repair_family_learning_module,
    list_repair_families,
)

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


@router.get("/{family_id}/module", response_model=RepairFamilyLearningModuleResponse)
def family_learning_module(
    family_id: str, db: Session = Depends(get_db)
) -> RepairFamilyLearningModuleResponse:
    response = get_repair_family_learning_module(db, family_id)
    if response is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repair family not found.",
        )
    return response
