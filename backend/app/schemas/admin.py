from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AdminUserItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
    approval_status: str
    country_code: str | None
    ec_location_id: int | None
    ec_location_name: str | None
    created_at: datetime
    approved_at: datetime | None
    last_login_at: datetime | None


class AdminUserListResponse(BaseModel):
    users: list[AdminUserItem]
    total: int
    pending_count: int


class AdminActionResponse(BaseModel):
    message: str
    user: AdminUserItem
