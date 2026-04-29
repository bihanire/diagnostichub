from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.common import RelatedProceduresResponse
from app.services.procedure_service import get_related_procedures

router = APIRouter(tags=["related"])


@router.get("/related/{procedure_id}", response_model=RelatedProceduresResponse)
def related(procedure_id: int, db: Session = Depends(get_db)) -> RelatedProceduresResponse:
    return RelatedProceduresResponse(
        procedure_id=procedure_id,
        items=get_related_procedures(db, procedure_id),
    )
