from pydantic import BaseModel, Field

from app.schemas.common import CustomerCare, ProcedureSummary, SopLayers


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)


class StructuredIntent(BaseModel):
    issue_type: str | None = None
    symptoms: list[str] = Field(default_factory=list)


class SearchResponse(BaseModel):
    query: str
    structured_intent: StructuredIntent
    confidence: float
    confidence_state: str
    confidence_margin: float
    needs_review: bool = False
    review_message: str | None = None
    suggested_next_step: str
    best_match: ProcedureSummary | None = None
    alternatives: list[ProcedureSummary] = Field(default_factory=list)
    related: list[ProcedureSummary] = Field(default_factory=list)
    customer_care: CustomerCare | None = None
    sop_preview: SopLayers | None = None
    no_match: bool = False
    message: str
