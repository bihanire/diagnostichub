from typing import Literal

from pydantic import BaseModel, Field


class WorkflowValidationIssue(BaseModel):
    procedure_id: int
    procedure_title: str
    severity: Literal["error", "warning"]
    message: str
    node_id: int | None = None


class WorkflowValidationReport(BaseModel):
    validated_procedures: int
    validated_nodes: int
    error_count: int
    warning_count: int
    issues: list[WorkflowValidationIssue] = Field(default_factory=list)


class ReadinessResponse(BaseModel):
    status: Literal["ok", "not_ready"]
    database_ok: bool
    workflow_validation: WorkflowValidationReport
