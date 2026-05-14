from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TicketDraftFamily(BaseModel):
    id: str | None = None
    title: str | None = None
    trackTitle: str | None = None


class TicketDraftProcedure(BaseModel):
    id: int
    title: str
    category: str
    description: str | None = None
    outcome: str | None = None
    warranty_status: str | None = None


class TicketDraftAnswer(BaseModel):
    node_id: int
    question: str
    answer: Literal["yes", "no"]


class TicketDraftWatuDecision(BaseModel):
    decisionLabel: str | None = None
    warrantyDirection: str | None = None
    ticketReadiness: Literal["needs_triage_completion", "ready_for_ticket_draft"]


class TicketDraftPreviewRequest(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    schemaVersion: Literal["diagnostichub.case_packet.v1"]
    source: Literal["diagnostic_hub"]
    eventName: Literal["diagnostic.case.completed", "diagnostic.case.in_progress"]
    createdAt: datetime
    idempotencyKey: str = Field(min_length=8, max_length=240)
    privacyClassification: Literal["internal_operational", "contains_customer_free_text"]
    query: str = Field(min_length=1, max_length=500)
    family: TicketDraftFamily
    procedure: TicketDraftProcedure
    answers: list[TicketDraftAnswer] = Field(default_factory=list, max_length=50)
    diagnosis: str | None = Field(default=None, max_length=800)
    recommendation: str | None = Field(default=None, max_length=800)
    decisionLabel: str | None = Field(default=None, max_length=160)
    warrantyDirection: str | None = Field(default=None, max_length=160)
    evidenceChecklist: list[str] = Field(default_factory=list, max_length=30)
    dispatchGateConfirmed: list[str] = Field(default_factory=list, max_length=30)
    feedbackStatus: Literal["saved", "not_saved"]
    ticketReadiness: Literal["needs_triage_completion", "ready_for_ticket_draft"]
    evidenceState: Literal["not_required", "pending", "complete"]
    deliveryReadiness: Literal[
        "blocked_incomplete_triage",
        "blocked_missing_evidence",
        "ready_for_operator_review",
    ]
    watuDecision: TicketDraftWatuDecision
    knowledgeSourceIds: list[str] = Field(default_factory=list, max_length=40)


class TicketDraftRequirementStatus(BaseModel):
    id: str
    label: str
    ready: bool
    note: str


class TicketDraftPreviewResponse(BaseModel):
    dry_run: bool
    delivery_enabled: bool
    draft_status: Literal["blocked", "ready_for_operator_review"]
    external_ticket_id: str | None = None
    blockers: list[str] = Field(default_factory=list)
    ticket_fields: dict[str, str | list[str]]
    webhook_requirements: list[TicketDraftRequirementStatus]
    message: str
