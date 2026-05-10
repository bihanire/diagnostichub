from time import perf_counter
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import get_settings
from app.core.logging import get_logger, request_id_context
from app.services.telemetry_service import get_telemetry_collector

logger = get_logger("relational_encyclopedia.http")
settings = get_settings()


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        telemetry = get_telemetry_collector()
        client_request_id = request.headers.get("X-Client-Request-ID")
        legacy_request_id = request.headers.get("X-Request-ID")
        if settings.request_correlation_enabled:
            request_id = client_request_id or legacy_request_id or uuid4().hex
        else:
            request_id = legacy_request_id or uuid4().hex

        request.state.client_request_id = client_request_id
        request.state.request_id = request_id

        token = request_id_context.set(request_id)
        started_at = perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((perf_counter() - started_at) * 1000, 2)
            telemetry.record_http_request(
                method=request.method,
                path=request.url.path,
                status_code=500,
                duration_ms=duration_ms,
            )
            telemetry.record_event(
                event="request_failed",
                status="error",
                metadata={
                    "method": request.method,
                    "path": request.url.path,
                    "client_request_id": client_request_id or "-",
                },
                request_id=request_id,
            )
            logger.warning(
                "request_failed_forwarded",
                extra={
                    "event": "request_failed_forwarded",
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                    "client_request_id": client_request_id,
                    "request_id": request_id,
                },
            )
            request_id_context.reset(token)
            raise

        response.headers["X-Request-ID"] = request_id
        # Keep auth handling inside the app UI. A `WWW-Authenticate` challenge
        # can trigger browser-level username/password popups, which we do not use.
        if response.status_code == 401 and "www-authenticate" in response.headers:
            del response.headers["www-authenticate"]
        duration_ms = round((perf_counter() - started_at) * 1000, 2)
        telemetry.record_http_request(
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        log_method = logger.warning if response.status_code >= 400 else logger.debug
        log_method(
            "request_completed",
            extra={
                "event": "request_completed",
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "client_request_id": client_request_id,
                "request_id": request_id,
            },
        )
        request_id_context.reset(token)
        return response
