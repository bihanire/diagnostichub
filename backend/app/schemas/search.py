from pydantic import BaseModel, Field

from app.schemas.common import CustomerCare, ProcedureSummary, SopLayers


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)


class StructuredIntent(BaseModel):
    issue_type: str | None = None
    symptoms: list[str] = Field(default_factory=list)


class SemanticInsight(BaseModel):
    normalized_query: str
    key_terms: list[str] = Field(default_factory=list)
    ambiguity_risk: str
    intent_strength: float
    matched_category_signals: dict[str, int] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    query: str
    structured_intent: StructuredIntent
    semantic_insight: SemanticInsight | None = None
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
