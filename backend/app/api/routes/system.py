import asyncio
from time import perf_counter
from typing import Callable, Literal

from fastapi import APIRouter, HTTPException, Request, Response, status

from app.core.config import get_settings
from app.core.database import database_is_ready
from app.schemas.system import (
    ApiMetaResponse,
    DataIntegrityReport,
    HealthResponse,
    ReadinessResponse,
    WorkflowValidationReport,
)

router = APIRouter(tags=["system"])


def _required_env_ok() -> bool:
    settings = get_settings()
    if not settings.database_url.strip():
        return False
    if settings.ops_auth_enabled:
        if not settings.ops_shared_password or not settings.ops_session_secret:
            return False
    return True


async def _run_check_with_timeout(
    check_name: str,
    check_func: Callable[[], bool],
    *,
    timeout_ms: int,
) -> tuple[str, Literal["ok", "failed"]]:
    timeout_seconds = max(timeout_ms, 50) / 1000
    try:
        result = await asyncio.wait_for(asyncio.to_thread(check_func), timeout=timeout_seconds)
    except Exception:
        return check_name, "failed"
    return check_name, "ok" if result else "failed"


def _empty_workflow_report() -> WorkflowValidationReport:
    return WorkflowValidationReport(
        validated_procedures=0,
        validated_nodes=0,
        error_count=1,
        warning_count=0,
        issues=[],
    )


def _empty_integrity_report() -> DataIntegrityReport:
    return DataIntegrityReport(
        validated_procedures=0,
        validated_nodes=0,
        error_count=1,
        warning_count=0,
        issues=[],
    )


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    db_ok = database_is_ready()
    return HealthResponse(
        status="ok" if db_ok else "degraded",
        db=db_ok,
        version=settings.api_version,
    )


@router.get("/meta", response_model=ApiMetaResponse)
async def meta() -> ApiMetaResponse:
    settings = get_settings()
    if not settings.api_meta_enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API metadata endpoint is disabled.",
        )

    return ApiMetaResponse(
        api_version=settings.api_version,
        schema_version=settings.schema_version,
        build=settings.build_sha,
    )


@router.get("/ready", response_model=ReadinessResponse)
async def ready(request: Request, response: Response) -> ReadinessResponse:
    settings = get_settings()
    started_at = perf_counter()

    workflow_validation = getattr(request.app.state, "workflow_validation", None)
    if workflow_validation is None:
        workflow_validation = _empty_workflow_report()

    data_integrity = getattr(request.app.state, "data_integrity", None)
    if data_integrity is None:
        data_integrity = _empty_integrity_report()

    if not settings.readiness_probe_enabled:
        latency_ms = round((perf_counter() - started_at) * 1000, 2)
        return ReadinessResponse(
            status="ok",
            checks={},
            failed=[],
            latency_ms=latency_ms,
            database_ok=True,
            workflow_validation=workflow_validation,
            data_integrity=data_integrity,
        )

    timeout_ms = settings.readiness_probe_timeout_ms

    check_results: dict[str, Literal["ok", "failed"]] = dict(
        await asyncio.gather(
            _run_check_with_timeout("db", database_is_ready, timeout_ms=timeout_ms),
            _run_check_with_timeout(
                "required_env",
                _required_env_ok,
                timeout_ms=min(timeout_ms, 200),
            ),
        )
    )
    check_results["workflow_validation"] = "ok" if workflow_validation.error_count == 0 else "failed"
    check_results["data_integrity"] = "ok" if data_integrity.error_count == 0 else "failed"

    failed = [name for name, result in check_results.items() if result != "ok"]
    database_ok = check_results.get("db") == "ok"
    readiness_status: Literal["ok", "degraded"] = "ok" if not failed else "degraded"

    if readiness_status != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    latency_ms = round((perf_counter() - started_at) * 1000, 2)
    return ReadinessResponse(
        status=readiness_status,
        checks=check_results,
        failed=failed,
        latency_ms=latency_ms,
        database_ok=database_ok,
        workflow_validation=workflow_validation,
        data_integrity=data_integrity,
    )
