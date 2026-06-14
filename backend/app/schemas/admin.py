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


class AllowedEmailItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    notes: str | None
    created_at: datetime


class AllowedEmailListResponse(BaseModel):
    emails: list[AllowedEmailItem]
    total: int


class AllowedEmailAddRequest(BaseModel):
    email: str
    notes: str | None = None


class AllowedEmailAddResponse(BaseModel):
    message: str
    item: AllowedEmailItem


# ── Invites ───────────────────────────────────────────────────────────────────

class InviteItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    token: str
    label: str | None
    ec_location_id: int
    country_code: str
    role: str
    expires_at: datetime
    max_uses: int | None
    use_count: int
    auto_approve: bool
    is_active: bool
    created_at: datetime


class InviteListResponse(BaseModel):
    invites: list[InviteItem]


class InviteCreateRequest(BaseModel):
    ec_location_id: int
    country_code: str
    role: str = "ec_agent"
    label: str | None = None
    expires_in_days: int = 14
    max_uses: int | None = None
    auto_approve: bool = False


class InviteCreateResponse(BaseModel):
    message: str
    invite: InviteItem


class InviteInfoResponse(BaseModel):
    ec_name: str
    ec_id: int
    country_code: str
    role: str
    label: str | None
    expires_at: datetime
    auto_approve: bool
    valid: bool


class InviteOTPVerifyRequest(BaseModel):
    email: str
    code: str
    full_name: str


class InviteOTPVerifyResponse(BaseModel):
    action: str  # "dashboard" | "pending"
    auto_approved: bool = False


# ── Activity ──────────────────────────────────────────────────────────────────

class ECActivityItem(BaseModel):
    ec_id: int
    ec_name: str
    country_code: str
    agent_count: int
    cases_30d: int
    last_case_at: datetime | None


class AgentActivityItem(BaseModel):
    user_id: int
    full_name: str
    email: str
    ec_name: str | None
    role: str
    cases_30d: int
    last_login_at: datetime | None
    last_case_at: datetime | None


class ActivitySummary(BaseModel):
    total_active_agents: int
    total_cases_30d: int
    active_ecs: int
    pending_approvals: int


class ActivityResponse(BaseModel):
    generated_at: datetime
    summary: ActivitySummary
    by_ec: list[ECActivityItem]
    top_agents: list[AgentActivityItem]
