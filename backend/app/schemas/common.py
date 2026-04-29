from pydantic import BaseModel, ConfigDict, Field


class ProcedureSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    category: str
    description: str
    outcome: str | None = None
    warranty_status: str | None = None


class CustomerCare(BaseModel):
    greeting: str
    listening: str
    expectation: str


class SopLayers(BaseModel):
    immediate_action: str
    explanation: str | None = None
    related_actions: list[str] = Field(default_factory=list)


class DecisionNodePayload(BaseModel):
    id: int
    question: str


class ProgressPayload(BaseModel):
    step: int
    total: int


class WarrantyAssessmentPayload(BaseModel):
    direction: str
    label: str
    confidence: str
    reasons: list[str] = Field(default_factory=list)


class BranchPlaybookPayload(BaseModel):
    title: str
    steps: list[str] = Field(default_factory=list)


class FinalOutcomePayload(BaseModel):
    diagnosis: str
    recommended_action: str
    decision_type: str
    decision_label: str
    warranty_status: str | None = None
    warranty_assessment: WarrantyAssessmentPayload
    branch_playbook: BranchPlaybookPayload
    related_actions: list[str] = Field(default_factory=list)
    evidence_checklist: list[str] = Field(default_factory=list)
    customer_care: CustomerCare
    follow_up_message: str


class RelatedProceduresResponse(BaseModel):
    procedure_id: int
    items: list[ProcedureSummary]
