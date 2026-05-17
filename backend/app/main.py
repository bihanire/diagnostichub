from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.feedback import router as feedback_router
from app.api.routes.families import router as families_router
from app.api.routes.ops import router as ops_router
from app.api.routes.related import router as related_router
from app.api.routes.search import router as search_router
from app.api.routes.system import router as system_router
from app.api.routes.telemetry import router as telemetry_router
from app.api.routes.ticket_draft import router as ticket_draft_router
from app.api.routes.triage import router as triage_router
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.error_handling import register_error_handlers
from app.core.logging import configure_logging, get_logger
from app.db.seed import create_schema, seed_data
from app.middleware.request_context import RequestContextMiddleware
from app.schemas.system import DataIntegrityReport, WorkflowValidationReport
from app.services.data_integrity_service import validate_data_integrity
from app.services.ops_auth_service import validate_ops_auth_settings
from app.services.telemetry_service import get_telemetry_collector
from app.services.workflow_validation_service import validate_procedure_workflows

settings = get_settings()
configure_logging(settings.log_level)
logger = get_logger("relational_encyclopedia.startup")


def _log_validation_report(report: WorkflowValidationReport) -> None:
    for issue in report.issues:
        log_method = logger.error if issue.severity == "error" else logger.warning
        log_method(
            issue.message,
            extra={
                "event": "workflow_validation_issue",
                "procedure_id": issue.procedure_id,
                "error_count": report.error_count,
                "warning_count": report.warning_count,
            },
        )


def _log_data_integrity_report(report: DataIntegrityReport) -> None:
    for issue in report.issues:
        log_method = logger.error if issue.severity == "error" else logger.warning
        log_method(
            issue.message,
            extra={
                "event": "data_integrity_issue",
                "procedure_id": issue.procedure_id,
                "node_id": issue.node_id,
                "error_count": report.error_count,
                "warning_count": report.warning_count,
            },
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    telemetry = get_telemetry_collector()
    validate_ops_auth_settings(settings)
    create_schema()
    if settings.seed_on_startup:
        seed_data()

    with SessionLocal() as db:
        report = validate_procedure_workflows(db)
        integrity_report = validate_data_integrity(db)

    app.state.workflow_validation = report
    app.state.data_integrity = integrity_report
    _log_validation_report(report)
    _log_data_integrity_report(integrity_report)
    telemetry.record_event(
        event="startup_integrity_validated",
        status="success" if integrity_report.error_count == 0 and report.error_count == 0 else "review",
        metadata={
            "workflow_errors": report.error_count,
            "workflow_warnings": report.warning_count,
            "integrity_errors": integrity_report.error_count,
            "integrity_warnings": integrity_report.warning_count,
        },
    )
    logger.info(
        "startup_complete",
        extra={
            "event": "startup_complete",
            "database_ok": True,
            "validated_procedures": report.validated_procedures,
            "error_count": report.error_count,
            "warning_count": report.warning_count,
        },
    )

    if settings.strict_workflow_validation and report.error_count > 0:
        raise RuntimeError("Workflow validation failed during startup.")
    if settings.strict_data_integrity_validation and integrity_report.error_count > 0:
        raise RuntimeError("Data integrity validation failed during startup.")
    yield


app = FastAPI(title=settings.app_name, version=settings.api_version, lifespan=lifespan)
if settings.standardize_error_responses:
    register_error_handlers(app)

app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

app.include_router(search_router)
app.include_router(system_router)
app.include_router(families_router)
app.include_router(triage_router)
app.include_router(related_router)
app.include_router(feedback_router)
app.include_router(ops_router)
app.include_router(telemetry_router)
app.include_router(ticket_draft_router)
