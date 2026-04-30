from datetime import datetime
from typing import Literal

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


class InteractionTelemetryPayload(BaseModel):
    total_events: int
    event_counts: dict[str, int] = Field(default_factory=dict)


InteractionEventName = Literal[
    "confidence_gate_shown",
    "confidence_gate_option_selected",
    "confidence_gate_confirmed",
    "confidence_gate_dismissed",
    "no_match_recovery_family_opened",
    "no_match_recovery_prompt_used",
    "best_match_direct_started",
]


class InteractionEventRequest(BaseModel):
    event: InteractionEventName
    status: Literal["info", "success", "review"] = "info"
    metadata: dict[str, str] = Field(default_factory=dict)


class InteractionEventResponse(BaseModel):
    accepted: bool = True


class TelemetrySummaryResponse(BaseModel):
    generated_at: datetime
    uptime_seconds: int
    total_http_requests: int
    active_endpoints: int
    endpoints: list[EndpointTelemetryPayload] = Field(default_factory=list)
    search: SearchTelemetryPayload
    interaction: InteractionTelemetryPayload
    recent_events: list[TelemetryEventPayload] = Field(default_factory=list)
