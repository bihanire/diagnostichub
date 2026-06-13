from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import (
    CustomerCare,
    DecisionNodePayload,
    FinalOutcomePayload,
    ProcedureSummary,
    ProgressPayload,
    SopLayers,
)


class DeviceItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    model_name: str
    samsung_code: str
    storage_gb: int | None = None
    ram_gb: int | None = None
    bom_version: str | None = None
    auto_blocker_required: bool
    display_label: str


class DeviceListResponse(BaseModel):
    devices: list[DeviceItem]


class PartsPredictionItem(BaseModel):
    part_name: str
    part_category: str | None = None


class PartsPredictionResponse(BaseModel):
    t_code: str
    parts: list[PartsPredictionItem]
    directional_note: str


class WarrantyNextRequest(BaseModel):
    primary_t_code: str = ""
    answers: list[Literal["yes", "no"]] = Field(default_factory=list)


class WarrantyNextResponse(BaseModel):
    status: Literal["question", "complete"]
    question_index: int | None = None
    question: str | None = None
    warranty_direction: Literal["IW", "OW"] | None = None
    wty_exception: str | None = None
    needs_review: bool = False
    auto_skipped: bool = False


class DispatchRouteRequest(BaseModel):
    src_group: str | None = None
    primary_t_code: str | None = None
    warranty_direction: Literal["IW", "OW"] | None = None
    warranty_needs_review: bool = False
    procedure_id: int | None = None


class DispatchRouteResponse(BaseModel):
    ls_code: str | None = None
    service_center: str | None = None
    route_note: str
    escalate: bool
    dispatch_class: Literal["iw_hardware", "ow_hardware", "customer_request", "needs_review"]
    pre_dispatch_checklist: list[str] = Field(default_factory=list)


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
