from fastapi import APIRouter, Depends

from app.schemas.telemetry import TelemetrySummaryResponse
from app.services.ops_auth_service import require_ops_session
from app.services.telemetry_service import get_telemetry_collector

router = APIRouter(prefix="/ops/telemetry", tags=["telemetry"])


@router.get("/summary", response_model=TelemetrySummaryResponse)
def telemetry_summary(_=Depends(require_ops_session)) -> TelemetrySummaryResponse:
    return get_telemetry_collector().snapshot()
