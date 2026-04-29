from __future__ import annotations

import argparse
from pathlib import Path

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.db.seed import create_schema
from app.db.sop_csv import (
    LINK_COLUMNS,
    NODE_COLUMNS,
    PROCEDURE_COLUMNS,
    TAG_COLUMNS,
    DecisionNodeRow,
    LinkedProcedureRow,
    ProcedureRow,
    SopImportError,
    SopImportPackage,
    TagRow,
    load_sop_directory,
)
from app.models.models import DecisionNode, LinkedNode, Procedure, Tag


def validate_import_package(
    package: SopImportPackage,
    existing_procedure_ids: set[int] | None = None,
) -> None:
    errors: list[str] = []
    existing_procedure_ids = existing_procedure_ids or set()

    procedure_ids = _find_duplicate_ids([row.id for row in package.procedures])
    node_ids = _find_duplicate_ids([row.id for row in package.decision_nodes])
    tag_pairs = _find_duplicate_pairs((row.procedure_id, row.keyword.lower()) for row in package.tags)
    link_pairs = _find_duplicate_pairs(
        (row.procedure_id, row.linked_procedure_id) for row in package.linked_procedures
    )

    errors.extend(f"Duplicate procedure id: {item}" for item in procedure_ids)
    errors.extend(f"Duplicate decision node id: {item}" for item in node_ids)
    errors.extend(f"Duplicate tag for procedure: {item}" for item in tag_pairs)
    errors.extend(f"Duplicate linked procedure pair: {item}" for item in link_pairs)

    imported_procedure_ids = {row.id for row in package.procedures}
    valid_link_procedure_ids = imported_procedure_ids | existing_procedure_ids
    nodes_by_procedure: dict[int, set[int]] = {}
    tags_by_procedure: dict[int, int] = {}

    for row in package.procedures:
        _require_text(errors, row.title, f"Procedure {row.id} title")
        _require_text(errors, row.category, f"Procedure {row.id} category")
        _require_text(errors, row.description, f"Procedure {row.id} description")
        _require_text(errors, row.immediate_action, f"Procedure {row.id} immediate_action")
        _require_text(errors, row.explanation, f"Procedure {row.id} explanation")

    for row in package.tags:
        if row.procedure_id not in imported_procedure_ids:
            errors.append(f"Tag references unknown procedure id: {row.procedure_id}")
        _require_text(errors, row.keyword, f"Tag for procedure {row.procedure_id}")
        tags_by_procedure[row.procedure_id] = tags_by_procedure.get(row.procedure_id, 0) + 1

    for row in package.decision_nodes:
        if row.procedure_id not in imported_procedure_ids:
            errors.append(f"Decision node {row.id} references unknown procedure id: {row.procedure_id}")
        _require_text(errors, row.question, f"Decision node {row.id} question")
        nodes_by_procedure.setdefault(row.procedure_id, set()).add(row.id)

        if row.is_final:
            for field_name, value in [
                ("diagnosis", row.diagnosis),
                ("recommended_action", row.recommended_action),
                ("outcome_warranty_status", row.outcome_warranty_status),
                ("follow_up_message", row.follow_up_message),
            ]:
                _require_text(errors, value, f"Decision node {row.id} final {field_name}")
            if row.yes_next is not None or row.no_next is not None:
                errors.append(f"Final decision node {row.id} should not have yes_next or no_next")
        elif row.yes_next is None and row.no_next is None:
            errors.append(f"Decision node {row.id} needs a next node or final outcome")

    for row in package.linked_procedures:
        if row.procedure_id not in imported_procedure_ids:
            errors.append(f"Linked procedure source is not in this import: {row.procedure_id}")
        if row.linked_procedure_id not in valid_link_procedure_ids:
            errors.append(f"Linked procedure target is unknown: {row.linked_procedure_id}")
        if row.procedure_id == row.linked_procedure_id:
            errors.append(f"Procedure {row.procedure_id} cannot link to itself")

    for procedure_id in imported_procedure_ids:
        if tags_by_procedure.get(procedure_id, 0) == 0:
            errors.append(f"Procedure {procedure_id} must include at least one tag")
        if procedure_id not in nodes_by_procedure:
            errors.append(f"Procedure {procedure_id} must include at least one decision node")

    all_node_ids = {row.id for row in package.decision_nodes}
    for row in package.decision_nodes:
        procedure_node_ids = nodes_by_procedure.get(row.procedure_id, set())
        for next_id, label in [(row.yes_next, "yes_next"), (row.no_next, "no_next")]:
            if next_id is None:
                continue
            if next_id not in all_node_ids:
                errors.append(f"Decision node {row.id} has broken {label} link: {next_id}")
            elif next_id not in procedure_node_ids:
                errors.append(f"Decision node {row.id} {label} points outside its procedure: {next_id}")

    if errors:
        raise SopImportError("SOP import validation failed:\n- " + "\n- ".join(errors))


def import_sop_session(
    db: Session,
    package: SopImportPackage,
    *,
    replace: bool = False,
) -> None:
    imported_procedure_ids = {row.id for row in package.procedures}
    existing_procedures = {
        procedure.id: procedure for procedure in db.scalars(select(Procedure)).all()
    }
    existing_procedure_ids = set(existing_procedures)

    validate_import_package(package, existing_procedure_ids)

    conflicts = imported_procedure_ids & existing_procedure_ids
    if conflicts and not replace:
        conflict_list = ", ".join(str(item) for item in sorted(conflicts))
        raise SopImportError(
            f"Procedure id(s) already exist: {conflict_list}. Rerun with --replace to overwrite them."
        )

    if replace and conflicts:
        db.execute(
            delete(LinkedNode).where(
                or_(
                    LinkedNode.procedure_id.in_(imported_procedure_ids),
                    LinkedNode.linked_procedure_id.in_(imported_procedure_ids),
                )
            )
        )
        db.execute(delete(Tag).where(Tag.procedure_id.in_(imported_procedure_ids)))
        db.execute(delete(DecisionNode).where(DecisionNode.procedure_id.in_(imported_procedure_ids)))
        db.flush()

    for row in package.procedures:
        procedure = existing_procedures.get(row.id)
        if procedure is None:
            procedure = Procedure(id=row.id)
            db.add(procedure)
            existing_procedures[row.id] = procedure

        procedure.title = row.title
        procedure.category = row.category
        procedure.description = row.description
        procedure.steps = {
            "immediate_action": row.immediate_action,
            "explanation": row.explanation,
            "related_actions": row.related_actions,
            "customer_care": {
                "greeting": row.customer_greeting,
                "listening": row.customer_listening,
                "expectation": row.customer_expectation,
            },
        }
        procedure.outcome = row.outcome
        procedure.warranty_status = row.warranty_status
    db.flush()

    for row in package.tags:
        db.add(Tag(keyword=row.keyword, procedure_id=row.procedure_id))

    node_relationships: list[tuple[DecisionNode, int | None, int | None]] = []
    for row in package.decision_nodes:
        node = DecisionNode(
            id=row.id,
            procedure_id=row.procedure_id,
            question=row.question,
            yes_next=None,
            no_next=None,
            final_outcome=_build_final_outcome(row),
        )
        db.add(node)
        node_relationships.append((node, row.yes_next, row.no_next))

    db.flush()

    for node, yes_next, no_next in node_relationships:
        node.yes_next = yes_next
        node.no_next = no_next

    for row in package.linked_procedures:
        db.add(
            LinkedNode(
                procedure_id=row.procedure_id,
                linked_procedure_id=row.linked_procedure_id,
            )
        )


def import_sop_directory(path: str | Path, *, replace: bool = False, dry_run: bool = False) -> SopImportPackage:
    package = load_sop_directory(path)
    with SessionLocal() as db:
        existing_procedure_ids = set(db.scalars(select(Procedure.id)).all())
        validate_import_package(package, existing_procedure_ids)
        if dry_run:
            return package

        import_sop_session(db, package, replace=replace)
        db.commit()

    return package


def _build_final_outcome(row: DecisionNodeRow) -> dict | None:
    if not row.is_final:
        return None

    return {
        "diagnosis": row.diagnosis,
        "recommended_action": row.recommended_action,
        "warranty_status": row.outcome_warranty_status,
        "related_actions": row.related_actions,
        "follow_up_message": row.follow_up_message,
    }


def _require_text(errors: list[str], value: str, label: str) -> None:
    if not value.strip():
        errors.append(f"{label} is required")


def _find_duplicate_ids(values: list[int]) -> list[int]:
    seen: set[int] = set()
    duplicates: set[int] = set()
    for value in values:
        if value in seen:
            duplicates.add(value)
        seen.add(value)
    return sorted(duplicates)


def _find_duplicate_pairs(values) -> list[tuple]:
    seen: set[tuple] = set()
    duplicates: set[tuple] = set()
    for value in values:
        if value in seen:
            duplicates.add(value)
        seen.add(value)
    return sorted(duplicates)


def main() -> None:
    parser = argparse.ArgumentParser(description="Import SOP CSV knowledge into DiagnosticHub.")
    parser.add_argument("--path", required=True, help="Directory containing SOP import CSV files.")
    parser.add_argument("--replace", action="store_true", help="Replace existing procedures with matching IDs.")
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing to the database.")
    args = parser.parse_args()

    create_schema()
    package = import_sop_directory(args.path, replace=args.replace, dry_run=args.dry_run)
    action = "Validated" if args.dry_run else "Imported"
    print(
        f"{action} {len(package.procedures)} procedures, "
        f"{len(package.tags)} tags, "
        f"{len(package.decision_nodes)} decision nodes, and "
        f"{len(package.linked_procedures)} linked procedures."
    )


if __name__ == "__main__":
    main()
