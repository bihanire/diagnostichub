from __future__ import annotations

import argparse
import csv
from pathlib import Path

from app.db.import_sop import (
    LINK_COLUMNS,
    NODE_COLUMNS,
    PROCEDURE_COLUMNS,
    TAG_COLUMNS,
    load_sop_directory,
    validate_import_package,
)
from app.db.sample_data import SAMPLE_PROCEDURES


def export_sample_sop_directory(path: str | Path) -> Path:
    base_path = Path(path)
    base_path.mkdir(parents=True, exist_ok=True)

    _write_csv(
        base_path / "procedures.csv",
        [
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
        ],
        _build_procedure_rows(),
        PROCEDURE_COLUMNS,
    )
    _write_csv(
        base_path / "tags.csv",
        ["procedure_id", "keyword"],
        _build_tag_rows(),
        TAG_COLUMNS,
    )
    _write_csv(
        base_path / "decision_nodes.csv",
        [
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
        ],
        _build_decision_node_rows(),
        NODE_COLUMNS,
    )
    _write_csv(
        base_path / "linked_procedures.csv",
        ["procedure_id", "linked_procedure_id"],
        _build_link_rows(),
        LINK_COLUMNS,
    )

    package = load_sop_directory(base_path)
    validate_import_package(package)
    return base_path


def _build_procedure_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for procedure in sorted(SAMPLE_PROCEDURES, key=lambda item: item["id"]):
        steps = procedure["steps"]
        customer_care = steps["customer_care"]
        rows.append(
            {
                "id": str(procedure["id"]),
                "title": procedure["title"],
                "category": procedure["category"],
                "description": procedure["description"],
                "immediate_action": steps["immediate_action"],
                "explanation": steps["explanation"],
                "warranty_status": procedure["warranty_status"],
                "outcome": procedure["outcome"],
                "customer_greeting": customer_care["greeting"],
                "customer_listening": customer_care["listening"],
                "customer_expectation": customer_care["expectation"],
                "related_actions": _pipe_join(steps["related_actions"]),
            }
        )
    return rows


def _build_tag_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for procedure in sorted(SAMPLE_PROCEDURES, key=lambda item: item["id"]):
        for keyword in procedure["tags"]:
            rows.append(
                {
                    "procedure_id": str(procedure["id"]),
                    "keyword": keyword,
                }
            )
    return rows


def _build_decision_node_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for procedure in sorted(SAMPLE_PROCEDURES, key=lambda item: item["id"]):
        for node in sorted(procedure["nodes"], key=lambda item: item["id"]):
            final_outcome = node.get("final_outcome") or {}
            rows.append(
                {
                    "id": str(node["id"]),
                    "procedure_id": str(procedure["id"]),
                    "question": node["question"],
                    "yes_next": _optional_int_text(node.get("yes_next")),
                    "no_next": _optional_int_text(node.get("no_next")),
                    "diagnosis": final_outcome.get("diagnosis", ""),
                    "recommended_action": final_outcome.get("recommended_action", ""),
                    "outcome_warranty_status": final_outcome.get("warranty_status", ""),
                    "related_actions": _pipe_join(final_outcome.get("related_actions", [])),
                    "follow_up_message": final_outcome.get("follow_up_message", ""),
                }
            )
    return rows


def _build_link_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for procedure in sorted(SAMPLE_PROCEDURES, key=lambda item: item["id"]):
        for linked_procedure_id in procedure["links"]:
            rows.append(
                {
                    "procedure_id": str(procedure["id"]),
                    "linked_procedure_id": str(linked_procedure_id),
                }
            )
    return rows


def _write_csv(
    path: Path,
    columns: list[str],
    rows: list[dict[str, str]],
    required_columns: set[str],
) -> None:
    if set(columns) != required_columns:
        raise ValueError(f"Export columns do not match the required schema for {path.name}.")

    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def _pipe_join(values: list[str]) -> str:
    return "|".join(value.strip() for value in values if value.strip())


def _optional_int_text(value: int | None) -> str:
    return "" if value is None else str(value)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export the seeded DiagnosticHub knowledge base into SOP import CSV files."
    )
    parser.add_argument(
        "--path",
        required=True,
        help="Directory where the SOP CSV files should be written.",
    )
    args = parser.parse_args()

    export_path = export_sample_sop_directory(args.path)
    package = load_sop_directory(export_path)
    print(
        f"Exported {len(package.procedures)} procedures, "
        f"{len(package.tags)} tags, "
        f"{len(package.decision_nodes)} decision nodes, and "
        f"{len(package.linked_procedures)} linked procedures to {export_path}."
    )


if __name__ == "__main__":
    main()
