from datetime import datetime

from pydantic import BaseModel, Field

FEEDBACK_TAG_OPTIONS = [
    "wrong_match",
    "confusing_question",
    "too_many_steps",
    "should_have_solved_at_branch",
    "should_have_escalated_sooner",
]


class FeedbackCreateRequest(BaseModel):
    helpful: bool
    procedure_id: int | None = None
    query: str | None = Field(default=None, max_length=500)
    branch_label: str | None = Field(default=None, max_length=120)
    comment: str | None = Field(default=None, max_length=1500)
    outcome_diagnosis: str | None = Field(default=None, max_length=500)
    feedback_tags: list[str] = Field(default_factory=list, max_length=5)
    triage_trace: list[dict] = Field(default_factory=list)
    final_decision_label: str | None = Field(default=None, max_length=120)
    search_confidence: float | None = None
    search_confidence_state: str | None = Field(default=None, max_length=40)


class FeedbackCreateResponse(BaseModel):
    id: int
    created_at: datetime
    message: str


class FeedbackEntryPayload(BaseModel):
    id: int
    helpful: bool
    procedure_id: int | None = None
    branch_label: str | None = None
    comment: str | None = None
    outcome_diagnosis: str | None = None
    feedback_tags: list[str] = Field(default_factory=list)
    final_decision_label: str | None = None
    triage_trace: list[dict] = Field(default_factory=list)
    created_at: datetime


class FeedbackSummaryResponse(BaseModel):
    total_submissions: int
    helpful_count: int
    not_helpful_count: int
    latest_submissions: list[FeedbackEntryPayload] = Field(default_factory=list)


class ProcedureFeedbackBreakdownItem(BaseModel):
    procedure_id: int | None = None
    procedure_title: str
    total_submissions: int
    helpful_count: int
    not_helpful_count: int


class ProcedureFeedbackBreakdownResponse(BaseModel):
    days: int
    items: list[ProcedureFeedbackBreakdownItem] = Field(default_factory=list)


class BranchFeedbackBreakdownItem(BaseModel):
    branch_label: str
    total_submissions: int
    helpful_count: int
    not_helpful_count: int


class BranchFeedbackBreakdownResponse(BaseModel):
    days: int
    items: list[BranchFeedbackBreakdownItem] = Field(default_factory=list)


class FeedbackLanguageCandidateItem(BaseModel):
    normalized_query: str
    sample_query: str
    total_mentions: int
    helpful_count: int
    not_helpful_count: int
    latest_procedure_title: str | None = None
    latest_branch_label: str | None = None
    latest_created_at: datetime | None = None


class FeedbackLanguageCandidateResponse(BaseModel):
    days: int
    items: list[FeedbackLanguageCandidateItem] = Field(default_factory=list)


class FeedbackTagBreakdownItem(BaseModel):
    tag: str
    total_submissions: int
    helpful_count: int
    not_helpful_count: int


class FeedbackTagBreakdownResponse(BaseModel):
    days: int
    items: list[FeedbackTagBreakdownItem] = Field(default_factory=list)
