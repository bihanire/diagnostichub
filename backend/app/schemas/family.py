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


class RepairFamilySignalEntry(BaseModel):
    key: str
    summary: str
    priority: str
    source: str
    signature: str
    signature_label: str
    occurrence_count: int = 1
    first_seen_order: int
    related_procedures: list[ProcedureSummary] = Field(default_factory=list)
    technical_notes: list[str] = Field(default_factory=list)


class RepairFamilySignalCluster(BaseModel):
    signature: str
    signature_label: str
    priority: str
    total_occurrences: int
    entries: list[RepairFamilySignalEntry] = Field(default_factory=list)


class RepairFamilySignalStream(BaseModel):
    original_event_count: int = 0
    deduplicated_event_count: int = 0
    critical_entries: list[RepairFamilySignalEntry] = Field(default_factory=list)
    need_to_know_entries: list[RepairFamilySignalEntry] = Field(default_factory=list)
    nice_to_know_entries: list[RepairFamilySignalEntry] = Field(default_factory=list)
    clusters: list[RepairFamilySignalCluster] = Field(default_factory=list)


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
    in_family_stream: RepairFamilySignalStream = Field(default_factory=RepairFamilySignalStream)
    procedures: list[ProcedureSummary] = Field(default_factory=list)
