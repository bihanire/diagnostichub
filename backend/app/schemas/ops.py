from datetime import datetime

from pydantic import BaseModel, Field


class OpsLoginRequest(BaseModel):
    password: str = Field(min_length=1, max_length=255)


class OpsSessionResponse(BaseModel):
    authenticated: bool
    expires_at: datetime | None = None
    message: str | None = None
