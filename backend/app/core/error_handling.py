from __future__ import annotations

import json
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger
from app.schemas.error import ErrorCode, ErrorEnvelope

logger = get_logger("relational_encyclopedia.errors")


def _request_id_from_state(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    if isinstance(request_id, str) and request_id.strip():
        return request_id
    return "unavailable"


def _status_to_code(status_code: int) -> ErrorCode:
    if status_code == status.HTTP_401_UNAUTHORIZED:
        return "AUTH_REQUIRED"
    if status_code == status.HTTP_403_FORBIDDEN:
        return "FORBIDDEN"
    if status_code == status.HTTP_404_NOT_FOUND:
        return "NOT_FOUND"
    if status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_422_UNPROCESSABLE_ENTITY):
        return "VALIDATION_ERROR"
    if status_code in (
        status.HTTP_408_REQUEST_TIMEOUT,
        status.HTTP_504_GATEWAY_TIMEOUT,
    ):
        return "TIMEOUT"
    if status_code == status.HTTP_503_SERVICE_UNAVAILABLE:
        return "NOT_READY"
    if status_code in (
        status.HTTP_502_BAD_GATEWAY,
        status.HTTP_424_FAILED_DEPENDENCY,
    ):
        return "UPSTREAM_ERROR"
    if status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
        return "INTERNAL_ERROR"
    return "VALIDATION_ERROR"


def _default_message_for_code(code: ErrorCode) -> str:
    if code == "NOT_READY":
        return "Service is temporarily not ready. Please retry shortly."
    if code == "AUTH_REQUIRED":
        return "You need to sign in before using this view."
    if code == "FORBIDDEN":
        return "You do not have permission to access this action."
    if code == "VALIDATION_ERROR":
        return "Some request details are invalid. Please review and try again."
    if code == "NOT_FOUND":
        return "The requested resource was not found."
    if code == "TIMEOUT":
        return "The request timed out. Please try again."
    if code == "UPSTREAM_ERROR":
        return "A dependency is currently unavailable. Please retry."
    return "Something went wrong while processing the request."


def _safe_detail(detail: Any, fallback: str) -> str:
    if isinstance(detail, str) and detail.strip():
        return detail
    if isinstance(detail, dict):
        try:
            return json.dumps(detail, ensure_ascii=True)
        except Exception:
            return fallback
    if isinstance(detail, list):
        try:
            return json.dumps(detail, ensure_ascii=True)
        except Exception:
            return fallback
    return fallback


def _error_envelope(
    *,
    code: ErrorCode,
    request_id: str,
    detail: str | None = None,
) -> ErrorEnvelope:
    message = _default_message_for_code(code)
    resolved_detail = detail or message
    return ErrorEnvelope(
        code=code,
        message=message,
        detail=resolved_detail,
        request_id=request_id,
    )


def _json_error_response(
    *,
    status_code: int,
    envelope: ErrorEnvelope,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=envelope.model_dump(),
        headers={"X-Request-ID": envelope.request_id},
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def starlette_http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        request_id = _request_id_from_state(request)
        code = _status_to_code(exc.status_code)
        detail = _safe_detail(exc.detail, _default_message_for_code(code))
        envelope = _error_envelope(code=code, request_id=request_id, detail=detail)
        logger.warning(
            "http_exception_standardized",
            extra={
                "event": "http_exception_standardized",
                "method": request.method,
                "path": request.url.path,
                "status_code": exc.status_code,
                "request_id": request_id,
            },
        )
        return _json_error_response(status_code=exc.status_code, envelope=envelope)

    @app.exception_handler(HTTPException)
    async def fastapi_http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        request_id = _request_id_from_state(request)
        code = _status_to_code(exc.status_code)
        detail = _safe_detail(exc.detail, _default_message_for_code(code))
        envelope = _error_envelope(code=code, request_id=request_id, detail=detail)
        logger.warning(
            "http_exception_standardized",
            extra={
                "event": "http_exception_standardized",
                "method": request.method,
                "path": request.url.path,
                "status_code": exc.status_code,
                "request_id": request_id,
            },
        )
        return _json_error_response(status_code=exc.status_code, envelope=envelope)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        request_id = _request_id_from_state(request)
        detail = _safe_detail(exc.errors(), _default_message_for_code("VALIDATION_ERROR"))
        envelope = _error_envelope(
            code="VALIDATION_ERROR",
            request_id=request_id,
            detail=detail,
        )
        logger.warning(
            "validation_exception_standardized",
            extra={
                "event": "validation_exception_standardized",
                "method": request.method,
                "path": request.url.path,
                "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "request_id": request_id,
            },
        )
        return _json_error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            envelope=envelope,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = _request_id_from_state(request)
        envelope = _error_envelope(
            code="INTERNAL_ERROR",
            request_id=request_id,
            detail=HTTPStatus.INTERNAL_SERVER_ERROR.phrase,
        )
        logger.exception(
            "unhandled_exception_standardized",
            extra={
                "event": "unhandled_exception_standardized",
                "method": request.method,
                "path": request.url.path,
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "request_id": request_id,
            },
        )
        return _json_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            envelope=envelope,
        )
