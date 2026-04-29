from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path


class SopImportError(ValueError):
    pass


@dataclass(frozen=True)
class ProcedureRow:
    id: int
    title: str
    category: str
    description: str
    immediate_action: str
    explanation: str
    warranty_status: str
    outcome: str
    customer_greeting: str
    customer_listening: str
    customer_expectation: str
    related_actions: list[str]


@dataclass(frozen=True)
class TagRow:
    procedure_id: int
    keyword: str


@dataclass(frozen=True)
class DecisionNodeRow:
    id: int
    procedure_id: int
    question: str
    yes_next: int | None
    no_next: int | None
    diagnosis: str
    recommended_action: str
    outcome_warranty_status: str
    related_actions: list[str]
    follow_up_message: str

    @property
    def is_final(self) -> bool:
        return any(
            [
                self.diagnosis,
                self.recommended_action,
                self.outcome_warranty_status,
                self.related_actions,
                self.follow_up_message,
            ]
        )


@dataclass(frozen=True)
class LinkedProcedureRow:
    procedure_id: int
    linked_procedure_id: int


@dataclass(frozen=True)
class SopImportPackage:
    procedures: list[ProcedureRow]
    tags: list[TagRow]
    decision_nodes: list[DecisionNodeRow]
    linked_procedures: list[LinkedProcedureRow]


PROCEDURE_COLUMNS = {
    "id",
    "title",
    "category",
    "description",
    "immediate_action",
    "explanation",
    "warranty_status",
    "outcome",
    "customer_greeting",
    "customer_listening",
    "customer_expectation",
    "related_actions",
}
TAG_COLUMNS = {"procedure_id", "keyword"}
NODE_COLUMNS = {
    "id",
    "procedure_id",
    "question",
    "yes_next",
    "no_next",
    "diagnosis",
    "recommended_action",
    "outcome_warranty_status",
    "related_actions",
    "follow_up_message",
}
LINK_COLUMNS = {"procedure_id", "linked_procedure_id"}


def load_sop_directory(path: str | Path) -> SopImportPackage:
    base_path = Path(path)
    return SopImportPackage(
        procedures=_load_procedures(base_path / "procedures.csv"),
        tags=_load_tags(base_path / "tags.csv"),
        decision_nodes=_load_decision_nodes(base_path / "decision_nodes.csv"),
        linked_procedures=_load_linked_procedures(base_path / "linked_procedures.csv"),
    )


def _load_procedures(path: Path) -> list[ProcedureRow]:
    rows = _read_csv(path, PROCEDURE_COLUMNS)
    return [
        ProcedureRow(
            id=_required_int(row, "id", path),
            title=_text(row, "title"),
            category=_text(row, "category"),
            description=_text(row, "description"),
            immediate_action=_text(row, "immediate_action"),
            explanation=_text(row, "explanation"),
            warranty_status=_text(row, "warranty_status"),
            outcome=_text(row, "outcome"),
            customer_greeting=_text(row, "customer_greeting"),
            customer_listening=_text(row, "customer_listening"),
            customer_expectation=_text(row, "customer_expectation"),
            related_actions=_pipe_list(row.get("related_actions", "")),
        )
        for row in rows
    ]


def _load_tags(path: Path) -> list[TagRow]:
    rows = _read_csv(path, TAG_COLUMNS)
    return [
        TagRow(
            procedure_id=_required_int(row, "procedure_id", path),
            keyword=_text(row, "keyword"),
        )
        for row in rows
    ]


def _load_decision_nodes(path: Path) -> list[DecisionNodeRow]:
    rows = _read_csv(path, NODE_COLUMNS)
    return [
        DecisionNodeRow(
            id=_required_int(row, "id", path),
            procedure_id=_required_int(row, "procedure_id", path),
            question=_text(row, "question"),
            yes_next=_optional_int(row, "yes_next", path),
            no_next=_optional_int(row, "no_next", path),
            diagnosis=_text(row, "diagnosis"),
            recommended_action=_text(row, "recommended_action"),
            outcome_warranty_status=_text(row, "outcome_warranty_status"),
            related_actions=_pipe_list(row.get("related_actions", "")),
            follow_up_message=_text(row, "follow_up_message"),
        )
        for row in rows
    ]


def _load_linked_procedures(path: Path) -> list[LinkedProcedureRow]:
    rows = _read_csv(path, LINK_COLUMNS)
    return [
        LinkedProcedureRow(
            procedure_id=_required_int(row, "procedure_id", path),
            linked_procedure_id=_required_int(row, "linked_procedure_id", path),
        )
        for row in rows
    ]


def _read_csv(path: Path, required_columns: set[str]) -> list[dict[str, str]]:
    if not path.exists():
        raise SopImportError(f"Missing required CSV file: {path}")

    with path.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        fieldnames = set(reader.fieldnames or [])
        missing = required_columns - fieldnames
        if missing:
            missing_columns = ", ".join(sorted(missing))
            raise SopImportError(f"{path.name} is missing column(s): {missing_columns}")
        return [dict(row) for row in reader]


def _required_int(row: dict[str, str], column: str, path: Path) -> int:
    value = _text(row, column)
    if not value:
        raise SopImportError(f"{path.name} has a blank required integer column: {column}")
    try:
        return int(value)
    except ValueError as exc:
        raise SopImportError(f"{path.name} has an invalid integer in {column}: {value}") from exc


def _optional_int(row: dict[str, str], column: str, path: Path) -> int | None:
    value = _text(row, column)
    if not value:
        return None
    try:
        return int(value)
    except ValueError as exc:
        raise SopImportError(f"{path.name} has an invalid integer in {column}: {value}") from exc


def _text(row: dict[str, str], column: str) -> str:
    return (row.get(column) or "").strip()


def _pipe_list(value: str) -> list[str]:
    return [item.strip() for item in value.split("|") if item.strip()]
