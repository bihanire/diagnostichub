from datetime import datetime

from pydantic import BaseModel, Field


class EndpointTelemetryPayload(BaseModel):
    method: str
    path: str
    total_requests: int
    success_count: int
    client_error_count: int
    server_error_count: int
    average_duration_ms: float
    p95_duration_ms: float


class TelemetryEventPayload(BaseModel):
    timestamp: datetime
    event: str
    status: str
    request_id: str | None = None
    metadata: dict[str, str] = Field(default_factory=dict)


class SearchTelemetryPayload(BaseModel):
    total_searches: int
    no_match_count: int
    review_required_count: int
    top_issue_types: dict[str, int] = Field(default_factory=dict)
    confidence_states: dict[str, int] = Field(default_factory=dict)
    ambiguity_risk_counts: dict[str, int] = Field(default_factory=dict)


class TelemetrySummaryResponse(BaseModel):
    generated_at: datetime
    uptime_seconds: int
    total_http_requests: int
    active_endpoints: int
    endpoints: list[EndpointTelemetryPayload] = Field(default_factory=list)
    search: SearchTelemetryPayload
    recent_events: list[TelemetryEventPayload] = Field(default_factory=list)
