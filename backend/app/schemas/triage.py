from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import (
    CustomerCare,
    DecisionNodePayload,
    FinalOutcomePayload,
    ProcedureSummary,
    ProgressPayload,
    SopLayers,
)


class TriageStartRequest(BaseModel):
    procedure_id: int


class TriageStartResponse(BaseModel):
    status: Literal["question", "complete"]
    procedure: ProcedureSummary
    current_node: DecisionNodePayload | None = None
    progress: ProgressPayload
    customer_care: CustomerCare
    sop: SopLayers
    outcome: FinalOutcomePayload | None = None


class TriageNextRequest(BaseModel):
    node_id: int
    answer: Literal["yes", "no"]


class TriageNextResponse(BaseModel):
    status: Literal["question", "complete"]
    progress: ProgressPayload
    next_node: DecisionNodePayload | None = None
    outcome: FinalOutcomePayload | None = None
    related: list[ProcedureSummary] = Field(default_factory=list)
    message: str | None = None
