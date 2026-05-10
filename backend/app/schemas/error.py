from typing import Literal

from pydantic import BaseModel

ErrorCode = Literal[
    "NOT_READY",
    "AUTH_REQUIRED",
    "FORBIDDEN",
    "VALIDATION_ERROR",
    "NOT_FOUND",
    "TIMEOUT",
    "UPSTREAM_ERROR",
    "INTERNAL_ERROR",
]


class ErrorEnvelope(BaseModel):
    code: ErrorCode
    message: str
    detail: str
    request_id: str
