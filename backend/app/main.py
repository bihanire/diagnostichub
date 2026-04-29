from contextlib import asynccontextmanager

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.feedback import router as feedback_router
from app.api.routes.families import router as families_router
from app.api.routes.ops import router as ops_router
from app.api.routes.related import router as related_router
from app.api.routes.search import router as search_router
from app.api.routes.triage import router as triage_router
from app.core.config import get_settings
from app.core.database import SessionLocal, database_is_ready
from app.core.logging import configure_logging, get_logger
from app.db.seed import create_schema, seed_data
from app.middleware.request_context import RequestContextMiddleware
from app.schemas.system import ReadinessResponse, WorkflowValidationReport
from app.services.ops_auth_service import validate_ops_auth_settings
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_ops_auth_settings(settings)
    create_schema()
    if settings.seed_on_startup:
        seed_data()

    with SessionLocal() as db:
        report = validate_procedure_workflows(db)

    app.state.workflow_validation = report
    _log_validation_report(report)
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
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
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
app.include_router(families_router)
app.include_router(triage_router)
app.include_router(related_router)
app.include_router(feedback_router)
app.include_router(ops_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready", response_model=ReadinessResponse)
def ready(response: Response) -> ReadinessResponse:
    workflow_validation = getattr(app.state, "workflow_validation", None)
    if workflow_validation is None:
        workflow_validation = WorkflowValidationReport(
            validated_procedures=0,
            validated_nodes=0,
            error_count=1,
            warning_count=0,
            issues=[],
        )

    database_ok = database_is_ready()
    status_value = "ok" if database_ok and workflow_validation.error_count == 0 else "not_ready"
    if status_value != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadinessResponse(
        status=status_value,
        database_ok=database_ok,
        workflow_validation=workflow_validation,
    )
