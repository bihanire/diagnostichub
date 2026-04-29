from time import perf_counter
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import get_logger, request_id_context

logger = get_logger("relational_encyclopedia.http")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or uuid4().hex
        request.state.request_id = request_id

        token = request_id_context.set(request_id)
        started_at = perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((perf_counter() - started_at) * 1000, 2)
            logger.exception(
                "request_failed",
                extra={
                    "event": "request_failed",
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
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
        log_method = logger.warning if response.status_code >= 400 else logger.debug
        log_method(
            "request_completed",
            extra={
                "event": "request_completed",
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        request_id_context.reset(token)
        return response
