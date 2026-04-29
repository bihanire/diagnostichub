from pydantic import BaseModel, Field

from app.schemas.common import ProcedureSummary


class RepairFamilyFocusCard(BaseModel):
    title: str
    description: str


class RepairFamilyProcedureGroup(BaseModel):
    title: str
    description: str
    procedures: list[ProcedureSummary] = Field(default_factory=list)


class RepairFamilyCategoryCard(BaseModel):
    title: str
    description: str
    search_examples: list[str] = Field(default_factory=list)
    primary_procedure: ProcedureSummary
    supporting_procedures: list[ProcedureSummary] = Field(default_factory=list)


class RepairFamilySummary(BaseModel):
    id: str
    title: str
    hint: str
    symptom_prompts: list[str] = Field(default_factory=list)
    procedure_count: int


class RepairFamilyDetailResponse(BaseModel):
    id: str
    title: str
    hint: str
    diagnostic_goal: str
    symptom_prompts: list[str] = Field(default_factory=list)
    focus_cards: list[RepairFamilyFocusCard] = Field(default_factory=list)
    common_categories: list[RepairFamilyCategoryCard] = Field(default_factory=list)
    procedure_groups: list[RepairFamilyProcedureGroup] = Field(default_factory=list)
    branch_checks: list[str] = Field(default_factory=list)
    escalation_signals: list[str] = Field(default_factory=list)
    procedures: list[ProcedureSummary] = Field(default_factory=list)
